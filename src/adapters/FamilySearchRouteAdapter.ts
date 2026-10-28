import { BaseAdapter, AdapterConfig, AdapterInput, AdapterOutput } from "./BaseAdapter";
import { UpstreamError } from "./UpstreamError";
import { SearchParams, SearchResult } from "./familysearch/schema";

export type FamilySearchMode = "person" | "search";

export interface FamilySearchSource {
  run(input: AdapterInput): Promise<AdapterOutput>;
  validate(output: AdapterOutput): AdapterOutput;
  search(params: SearchParams): Promise<SearchResult>;
}

const SEARCH_TERM_KEYS = [
  "givenName",
  "surname",
  "sex",
  "birthLikeDate",
  "birthLikePlace",
  "deathLikeDate",
  "deathLikePlace",
] as const;
const SEARCH_PAGING_KEYS = ["offset", "count"] as const;

const SEARCH_SCORE = 0.8;

function pickSearchParams(raw: Record<string, unknown>): SearchParams {
  const params: Record<string, unknown> = {};
  for (const key of [...SEARCH_TERM_KEYS, ...SEARCH_PAGING_KEYS]) {
    if (raw[key] !== undefined && raw[key] !== "") params[key] = raw[key];
  }
  return params as SearchParams;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export class FamilySearchRouteAdapter extends BaseAdapter {
  constructor(
    config: AdapterConfig,
    private source: FamilySearchSource
  ) {
    super(config);
  }

  normalize(input: any): AdapterInput {
    const body = typeof input === "string" ? { key: input } : input ?? {};
    const payload: Record<string, any> = body.payload ?? {};
    const mode: FamilySearchMode = payload.mode === "search" ? "search" : "person";

    if (mode === "search") {
      const params = pickSearchParams(payload);
      if (!SEARCH_TERM_KEYS.some((k) => k in params)) {
        throw new Error(
          `FamilySearch search requires at least one of: ${SEARCH_TERM_KEYS.join(", ")}`
        );
      }
      return {
        key: `search:${stableStringify(params)}`,
        payload: { mode, params },
      };
    }

    if (typeof body.key !== "string" || body.key.trim() === "") {
      throw new Error("FamilySearch person mode requires a non-empty key (PID)");
    }
    return { key: body.key.trim(), payload: { mode } };
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    if (input.payload.mode === "search") {
      return this.runSearch(input.payload.params);
    }
    const output = this.source.validate(await this.source.run(input));
    if (!output.success) {
      throw new UpstreamError(output.error ?? "FamilySearch request failed");
    }
    return output;
  }

  private async runSearch(params: SearchParams): Promise<AdapterOutput> {
    let result: SearchResult;
    try {
      result = await this.source.search(params);
    } catch (error) {
      throw new UpstreamError(error instanceof Error ? error.message : String(error));
    }
    const timestamp = Date.now();
    return {
      success: true,
      data: result,
      hydration: { cached: false, timestamp },
      score: SEARCH_SCORE,
      timestamp,
    };
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }
}
