import { BaseAdapter, AdapterConfig, AdapterInput, AdapterOutput } from "./BaseAdapter";
import { UpstreamError } from "./UpstreamError";

export type FamilySearchMode = "person" | "search";

export interface FamilySearchSource {
  run(input: AdapterInput): Promise<AdapterOutput>;
  validate(output: AdapterOutput): AdapterOutput;
  search(params: Record<string, unknown>): Promise<AdapterOutput>;
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
      const { mode: _mode, ...params } = payload;
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
    const output =
      input.payload.mode === "search"
        ? await this.source.search(input.payload.params ?? {})
        : this.source.validate(await this.source.run(input));

    if (!output.success) {
      throw new UpstreamError(output.error ?? "FamilySearch request failed");
    }
    return output;
  }

  validate(output: AdapterOutput): AdapterOutput {
    return output;
  }
}
