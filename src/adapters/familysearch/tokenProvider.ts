import axios from "axios";
import {
  AUTHORIZATION_PATH,
  FAMILYSEARCH_HOSTS,
  FamilySearchEnv,
  TOKEN_PATH,
} from "./environments";

export interface TokenProvider {
  getToken(): Promise<string>;
  invalidate(): void;
}

const MAX_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

export class FamilySearchAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FamilySearchAuthError";
  }
}

export class StaticTokenProvider implements TokenProvider {
  private token: string | undefined;

  constructor(token: string) {
    if (!token) {
      throw new FamilySearchAuthError("FAMILYSEARCH_ACCESS_TOKEN is empty");
    }
    this.token = token;
  }

  async getToken(): Promise<string> {
    if (!this.token) {
      throw new FamilySearchAuthError(
        "FamilySearch access token expired or was rejected (401). Obtain a new token via the Authorization Code flow and set FAMILYSEARCH_ACCESS_TOKEN."
      );
    }
    return this.token;
  }

  invalidate(): void {
    this.token = undefined;
  }
}

interface TokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
}

export interface RefreshTokenProviderOptions {
  env: FamilySearchEnv;
  clientId: string;
  refreshToken: string;
  accessToken?: string;
  clientSecret?: string;
  timeoutMs?: number;
  now?: () => number;
}

export class RefreshTokenProvider implements TokenProvider {
  private accessToken: string | undefined;
  private expiresAt = 0;
  private refreshToken: string;
  private inFlight: Promise<string> | undefined;
  private readonly now: () => number;

  constructor(private readonly opts: RefreshTokenProviderOptions) {
    this.refreshToken = opts.refreshToken;
    this.now = opts.now ?? Date.now;
    if (opts.accessToken) {
      this.accessToken = opts.accessToken;
      this.expiresAt = this.now() + MAX_TOKEN_LIFETIME_MS - EXPIRY_SKEW_MS;
    }
  }

  async getToken(): Promise<string> {
    if (this.accessToken && this.now() < this.expiresAt) {
      return this.accessToken;
    }
    return this.refresh();
  }

  invalidate(): void {
    this.accessToken = undefined;
    this.expiresAt = 0;
  }

  private refresh(): Promise<string> {
    this.inFlight ??= this.requestToken().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async requestToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.opts.clientId,
      refresh_token: this.refreshToken,
    });
    if (this.opts.clientSecret) {
      body.set("client_secret", this.opts.clientSecret);
    }
    const data = await postTokenForm(
      this.opts.env,
      body,
      this.opts.timeoutMs
    );
    this.accessToken = data.accessToken;
    this.expiresAt = this.now() + data.lifetimeMs - EXPIRY_SKEW_MS;
    if (data.refreshToken) this.refreshToken = data.refreshToken;
    return data.accessToken;
  }
}

interface ParsedToken {
  accessToken: string;
  refreshToken?: string;
  lifetimeMs: number;
}

async function postTokenForm(
  env: FamilySearchEnv,
  body: URLSearchParams,
  timeoutMs = 10000
): Promise<ParsedToken> {
  let data: TokenResponse;
  try {
    const response = await axios.post<TokenResponse>(
      `${FAMILYSEARCH_HOSTS[env].ident}${TOKEN_PATH}`,
      body.toString(),
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: timeoutMs,
      }
    );
    data = response.data;
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const oauthError = axios.isAxiosError(error)
      ? (error.response?.data as { error?: unknown } | undefined)?.error
      : undefined;
    throw new FamilySearchAuthError(
      `FamilySearch token request failed${status ? ` (HTTP ${status})` : ""}${
        typeof oauthError === "string" ? `: ${oauthError}` : ""
      }`
    );
  }
  if (typeof data?.access_token !== "string" || !data.access_token) {
    throw new FamilySearchAuthError(
      "FamilySearch token response missing access_token"
    );
  }
  const expiresIn =
    typeof data.expires_in === "number" && data.expires_in > 0
      ? data.expires_in * 1000
      : MAX_TOKEN_LIFETIME_MS;
  return {
    accessToken: data.access_token,
    refreshToken:
      typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    lifetimeMs: Math.min(expiresIn, MAX_TOKEN_LIFETIME_MS),
  };
}

export function buildAuthorizationUrl(params: {
  env: FamilySearchEnv;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    state: params.state,
  });
  return `${FAMILYSEARCH_HOSTS[params.env].ident}${AUTHORIZATION_PATH}?${query.toString()}`;
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken?: string;
  expiresInMs: number;
}

export async function exchangeAuthorizationCode(params: {
  env: FamilySearchEnv;
  clientId: string;
  redirectUri: string;
  code: string;
  timeoutMs?: number;
}): Promise<ExchangedTokens> {
  const parsed = await postTokenForm(
    params.env,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      code: params.code,
    }),
    params.timeoutMs
  );
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    expiresInMs: parsed.lifetimeMs,
  };
}

export function createTokenProviderFromEnv(
  env: FamilySearchEnv,
  vars: NodeJS.ProcessEnv = process.env
): TokenProvider {
  const accessToken = vars.FAMILYSEARCH_ACCESS_TOKEN;
  const refreshToken = vars.FAMILYSEARCH_REFRESH_TOKEN;
  const clientId = vars.FAMILYSEARCH_APP_KEY;

  if (refreshToken) {
    if (!clientId) {
      throw new FamilySearchAuthError(
        "FAMILYSEARCH_REFRESH_TOKEN requires FAMILYSEARCH_APP_KEY (the OAuth client_id)"
      );
    }
    return new RefreshTokenProvider({
      env,
      clientId,
      refreshToken,
      accessToken,
      clientSecret: vars.FAMILYSEARCH_CLIENT_SECRET || undefined,
    });
  }
  if (accessToken) return new StaticTokenProvider(accessToken);
  throw new FamilySearchAuthError(
    "Set FAMILYSEARCH_ACCESS_TOKEN (or FAMILYSEARCH_REFRESH_TOKEN with FAMILYSEARCH_APP_KEY)"
  );
}
