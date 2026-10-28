import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FamilySearchEnv, parseFamilySearchEnv } from "../environments";

export const DEFAULT_REDIRECT_URI = "http://localhost:3000/callback";
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface LoginConfig {
  env: FamilySearchEnv;
  appKey: string;
  redirectUri: string;
  port: number;
  callbackPath: string;
}

export function generateState(): string {
  return randomBytes(24).toString("base64url");
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function statesMatch(expected: string, actual: string | null): boolean {
  if (!actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function resolveLoginConfig(
  vars: NodeJS.ProcessEnv,
  allowProduction: boolean
): LoginConfig {
  const env = parseFamilySearchEnv(vars.FAMILYSEARCH_ENV);
  if (env !== "beta" && !allowProduction) {
    throw new Error(
      "FAMILYSEARCH_ENV is production; refusing. Use beta, or pass --allow-production."
    );
  }
  const appKey = vars.FAMILYSEARCH_APP_KEY;
  if (!appKey) throw new Error("FAMILYSEARCH_APP_KEY is not set");
  const redirectUri = vars.FAMILYSEARCH_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  const url = new URL(redirectUri);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("FAMILYSEARCH_REDIRECT_URI must be http://localhost or http://127.0.0.1");
  }
  const port = Number(url.port || 80);
  return { env, appKey, redirectUri, port, callbackPath: url.pathname };
}

export type CallbackResult =
  | { kind: "ignore" }
  | { kind: "error"; message: string }
  | { kind: "code"; code: string };

export function evaluateCallback(
  requestUrl: string,
  callbackPath: string,
  expectedState: string
): CallbackResult {
  const url = new URL(requestUrl, "http://localhost");
  if (url.pathname !== callbackPath) return { kind: "ignore" };
  if (!statesMatch(expectedState, url.searchParams.get("state"))) {
    return { kind: "error", message: "OAuth state mismatch" };
  }
  const oauthError = url.searchParams.get("error");
  if (oauthError) return { kind: "error", message: `Authorization denied: ${oauthError}` };
  const code = url.searchParams.get("code");
  if (!code) return { kind: "error", message: "Callback missing code" };
  return { kind: "code", code };
}

export function powershellTokenLine(token: string): string {
  return `$env:FAMILYSEARCH_ACCESS_TOKEN = '${token.replace(/'/g, "''")}'`;
}

export function powershellRefreshLine(token: string): string {
  return `$env:FAMILYSEARCH_REFRESH_TOKEN = '${token.replace(/'/g, "''")}'`;
}
