import axios, { AxiosInstance, AxiosResponse } from "axios";
import {
  BaseAdapter,
  AdapterConfig,
  AdapterInput,
  AdapterOutput,
} from "../BaseAdapter";
import {
  FAMILYSEARCH_HOSTS,
  FamilySearchEnv,
  parseFamilySearchEnv,
} from "./environments";
import { mapDocument, mapSearchFeed } from "./mapper";
import {
  FamilySearchResponse,
  GEDCOMX_ATOM_JSON,
  GEDCOMX_JSON,
  GedcomxDocument,
  SearchParams,
  SearchResult,
  validateAtomFeed,
  validateGedcomxPersonDocument,
} from "./schema";
import { TokenProvider, createTokenProviderFromEnv } from "./tokenProvider";

export interface FamilySearchConfig extends AdapterConfig {
  env?: FamilySearchEnv;
  tokenProvider: TokenProvider;
  maxRateLimitRetries?: number;
  maxRetryAfterMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class FamilySearchApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "FamilySearchApiError";
  }
}

export class PersonMergedError extends FamilySearchApiError {
  constructor(
    readonly requestedPid: string,
    readonly survivorPid?: string
  ) {
    super(
      `Person ${requestedPid} was merged${survivorPid ? ` into ${survivorPid}` : ""}; refresh the stored PID`,
      301
    );
    this.name = "PersonMergedError";
  }
}

export class PersonDeletedError extends FamilySearchApiError {
  constructor(readonly requestedPid: string) {
    super(`Person ${requestedPid} was deleted`, 410);
    this.name = "PersonDeletedError";
  }
}

const PERSON_PATH = /\/platform\/tree\/persons\/([^/?#]+)/;

function survivorOf(location: unknown): string | undefined {
  return typeof location === "string"
    ? PERSON_PATH.exec(location)?.[1]
    : undefined;
}

export interface WriteResponse {
  status: number;
  location?: string;
  entityId?: string;
}

interface WriteOptions {
  method: "post";
  data: unknown;
}

const DEFAULT_RETRY_AFTER_MS = 5000;
const DEFAULT_PAGE_SIZE = 20;

export class FamilySearchAdapter extends BaseAdapter {
  readonly env: FamilySearchEnv;
  private readonly client: AxiosInstance;
  private readonly tokens: TokenProvider;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRateLimitRetries: number;
  private readonly maxRetryAfterMs: number;

  constructor(fsConfig: FamilySearchConfig) {
    super(fsConfig);
    this.env = fsConfig.env ?? "beta";
    this.tokens = fsConfig.tokenProvider;
    this.sleep = fsConfig.sleep ?? ((ms) => this.delay(ms));
    this.maxRateLimitRetries = fsConfig.maxRateLimitRetries ?? 3;
    this.maxRetryAfterMs = fsConfig.maxRetryAfterMs ?? 60000;
    this.client = axios.create({
      baseURL: FAMILYSEARCH_HOSTS[this.env].api,
      timeout: fsConfig.timeout,
      validateStatus: () => true,
      // A merged person answers 301; following it turns a POST into a GET
      // (301/302) or re-posts the body to another person (307/308).
      maxRedirects: 0,
    });
  }

  static fromEnv(vars: NodeJS.ProcessEnv = process.env): FamilySearchAdapter {
    const env = parseFamilySearchEnv(vars.FAMILYSEARCH_ENV);
    return new FamilySearchAdapter({
      name: "familysearch",
      version: "2.0.0",
      timeout: Number(vars.ADAPTER_TIMEOUT) || 10000,
      retries: Number(vars.ADAPTER_RETRIES) || 3,
      env,
      tokenProvider: createTokenProviderFromEnv(env, vars),
    });
  }

  normalize(input: any): AdapterInput {
    if (typeof input === "string") {
      return { key: input, payload: {} };
    }

    if (input?.key && typeof input.key === "string") {
      return { key: input.key, payload: input.payload || {} };
    }

    throw new Error("Invalid FamilySearch input: missing or invalid key");
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    try {
      const response = await this.request(
        `/platform/tree/persons/${encodeURIComponent(input.key)}`,
        { relatives: true, sourceDescriptions: true },
        GEDCOMX_JSON
      );
      const doc = validateGedcomxPersonDocument(response.data);
      const data = mapDocument(doc);
      const timestamp = Date.now();

      return {
        success: true,
        data,
        hydration: { cached: false, timestamp },
        score: this.calculateConfidence(data, input.key),
        timestamp,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  async readPerson(pid: string): Promise<GedcomxDocument> {
    const response = await this.request(
      `/platform/tree/persons/${encodeURIComponent(pid)}`,
      { relatives: true, sourceDescriptions: true },
      GEDCOMX_JSON
    );
    const doc = validateGedcomxPersonDocument(response.data);
    if (!doc.persons?.some((p) => p.id === pid)) {
      throw new FamilySearchApiError(
        `FamilySearch response does not contain requested person ${pid}`
      );
    }
    return doc;
  }

  async readNotes(pid: string): Promise<Array<{ text?: string }>> {
    const response = await this.request(
      `/platform/tree/persons/${encodeURIComponent(pid)}/notes`,
      {},
      GEDCOMX_JSON
    );
    if (response.status === 204 || !response.data) return [];
    const notes = response.data?.persons?.find?.((p: { id?: string }) => p.id === pid)?.notes;
    return Array.isArray(notes) ? notes : [];
  }

  async postGedcomx(path: string, body: unknown): Promise<WriteResponse> {
    const response = await this.request(
      path,
      {},
      GEDCOMX_JSON,
      { method: "post", data: body }
    );
    const header = (name: string): string | undefined => {
      const value = response.headers?.[name];
      return typeof value === "string" ? value : undefined;
    };
    return {
      status: response.status,
      location: header("location"),
      entityId: header("x-entity-id"),
    };
  }

  async search(params: SearchParams): Promise<SearchResult> {
    const offset = Math.max(0, Math.floor(params.offset ?? 0));
    const count = Math.max(1, Math.floor(params.count ?? DEFAULT_PAGE_SIZE));

    const query: Record<string, string | number> = { offset, count };
    const terms: Array<[string, string | undefined]> = [
      ["q.givenName", params.givenName],
      ["q.surname", params.surname],
      ["q.sex", params.sex],
      ["q.birthLikeDate", params.birthLikeDate],
      ["q.birthLikePlace", params.birthLikePlace],
      ["q.deathLikeDate", params.deathLikeDate],
      ["q.deathLikePlace", params.deathLikePlace],
    ];
    for (const [key, value] of terms) {
      if (value) query[key] = value;
    }
    if (Object.keys(query).length === 2) {
      throw new Error("FamilySearch search requires at least one query term");
    }

    const response = await this.request(
      "/platform/tree/search",
      query,
      GEDCOMX_ATOM_JSON
    );
    if (response.status === 204 || !response.data) {
      return { total: 0, offset, hits: [], raw: {} };
    }
    return mapSearchFeed(validateAtomFeed(response.data), offset);
  }

  validate(output: AdapterOutput): AdapterOutput {
    if (!output.success) {
      return output;
    }

    try {
      this.validateSchema(output.data);
      return { ...output, score: Math.max(output.score || 0, 0.8) };
    } catch (error) {
      return {
        ...output,
        success: false,
        error: `Schema validation failed: ${error instanceof Error ? error.message : String(error)}`,
        score: 0,
      };
    }
  }

  private validateSchema(data: any): void {
    if (!data || typeof data !== "object") {
      throw new Error("Response is not an object");
    }
    if (!Array.isArray(data.persons) || data.persons.length === 0) {
      throw new Error("Missing or empty persons array");
    }
    if (!Array.isArray(data.relationships)) {
      throw new Error("Missing or invalid relationships array");
    }
    for (const person of data.persons) {
      if (!person.pid || !person.name) {
        throw new Error("Person missing required fields: pid, name");
      }
    }
    validateGedcomxPersonDocument(data.raw);
  }

  private calculateConfidence(
    data: FamilySearchResponse,
    rootId: string
  ): number {
    let score = 0.5;
    if (data.persons.length > 0) score += 0.2;
    if (data.sources.length > 0) score += 0.15;
    if (data.relationships.length > 0) score += 0.05;
    const root = data.persons.find((p) => p.pid === rootId);
    if (root?.lifespan.birth && root.lifespan.death) score += 0.1;
    return Math.min(score, 1.0);
  }

  private async request(
    path: string,
    params: Record<string, string | number | boolean>,
    accept: string,
    write?: WriteOptions
  ): Promise<AxiosResponse> {
    let authRetried = false;
    let rateLimited = 0;
    let transient = 0;

    for (;;) {
      const token = await this.tokens.getToken();
      let response: AxiosResponse;
      try {
        const headers = { Accept: accept, Authorization: `Bearer ${token}` };
        response = write
          ? await this.client.post(path, write.data, {
              headers: { ...headers, "Content-Type": GEDCOMX_JSON },
            })
          : await this.client.get(path, { params, headers });
      } catch (error) {
        if (write) {
          throw new FamilySearchApiError(
            `FamilySearch write failed without a response; not retried to avoid duplicates: ${error instanceof Error ? error.message : "network error"}`
          );
        }
        if (++transient >= this.config.retries) {
          throw new FamilySearchApiError(
            `FamilySearch request failed: ${error instanceof Error ? error.message : "network error"}`
          );
        }
        await this.sleep(Math.pow(2, transient) * 100);
        continue;
      }

      const { status } = response;
      // Writes create resources: only 201/204 count, never a bare 200.
      if (write ? status === 201 || status === 204 : status >= 200 && status < 300) {
        return response;
      }
      const requestedPid = PERSON_PATH.exec(path)?.[1] ?? path;
      if (status === 301) {
        throw new PersonMergedError(
          requestedPid,
          survivorOf(response.headers?.["location"])
        );
      }
      if (status === 410) throw new PersonDeletedError(requestedPid);

      if (status === 401 && !authRetried) {
        authRetried = true;
        this.tokens.invalidate();
        continue;
      }
      if (status === 429 && rateLimited < this.maxRateLimitRetries) {
        rateLimited++;
        await this.sleep(this.retryAfterMs(response));
        continue;
      }
      if (!write && status >= 500 && ++transient < this.config.retries) {
        await this.sleep(Math.pow(2, transient) * 100);
        continue;
      }
      throw new FamilySearchApiError(
        `FamilySearch API error: HTTP ${status}`,
        status
      );
    }
  }

  private retryAfterMs(response: AxiosResponse): number {
    const seconds = Number(response.headers?.["retry-after"]);
    const ms =
      Number.isFinite(seconds) && seconds >= 0
        ? seconds * 1000
        : DEFAULT_RETRY_AFTER_MS;
    return Math.min(ms, this.maxRetryAfterMs);
  }
}
