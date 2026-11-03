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

const MAX_SEARCH_COUNT = 100;

/** Validate once at the boundary; anything malformed is a client error. */
function pickSearchParams(raw: Record<string, unknown>): SearchParams {
  const params: Record<string, string | number> = {};
  for (const key of SEARCH_TERM_KEYS) {
    const value = raw[key];
    if (value === undefined || value === "") continue;
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`FamilySearch search param ${key} must be a non-empty string`);
    }
    params[key] = value.trim();
  }
  if (params.sex !== undefined && params.sex !== "Male" && params.sex !== "Female") {
    throw new Error("FamilySearch search param sex must be Male or Female");
  }
  for (const key of SEARCH_PAGING_KEYS) {
    const value = raw[key];
    if (value === undefined || value === "") continue;
    const min = key === "count" ? 1 : 0;
    const max = key === "count" ? MAX_SEARCH_COUNT : Number.MAX_SAFE_INTEGER;
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      throw new Error(`FamilySearch search param ${key} must be an integer in [${min}, ${max}]`);
    }
    params[key] = value;
  }
  return params as SearchParams;
}

/** The full GEDCOM X document can include living relatives; opt in to see it. */
function withoutRaw(data: any): any {
  if (!data || typeof data !== "object") return data;
  const { raw: _raw, ...rest } = data;
  if (Array.isArray(rest.hits)) {
    rest.hits = rest.hits.map(({ raw: _hitRaw, ...hit }: any) => hit);
  }
  return rest;
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
        payload: { mode, params, includeRaw: payload.includeRaw === true },
      };
    }

    if (typeof body.key !== "string" || body.key.trim() === "") {
      throw new Error("FamilySearch person mode requires a non-empty key (PID)");
    }
    return {
      key: body.key.trim(),
      payload: { mode, includeRaw: payload.includeRaw === true },
    };
  }

  async run(input: AdapterInput): Promise<AdapterOutput> {
    if (input.payload.mode === "search") {
      return this.runSearch(input.payload.params, input.payload.includeRaw);
    }
    const output = this.source.validate(await this.source.run(input));
    if (!output.success) {
      throw new UpstreamError(output.error ?? "FamilySearch request failed");
    }
    return input.payload.includeRaw
      ? output
      : { ...output, data: withoutRaw(output.data) };
  }

  private async runSearch(
    params: SearchParams,
    includeRaw = false
  ): Promise<AdapterOutput> {
    let result: SearchResult;
    try {
      result = await this.source.search(params);
    } catch (error) {
      throw new UpstreamError(error instanceof Error ? error.message : String(error));
    }
    const timestamp = Date.now();
    return {
      success: true,
      data: includeRaw ? result : withoutRaw(result),
      hydration: { cached: false, timestamp },
      score: SEARCH_SCORE,
      timestamp,
    };
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }
}
