import { AdapterRegistry } from "../adapters/AdapterRegistry";
import { FamilySearchAdapter } from "../adapters/familysearch/FamilySearchAdapter";
import {
  FamilySearchRouteAdapter,
  FamilySearchSource,
} from "../adapters/FamilySearchRouteAdapter";

export const FAMILYSEARCH_ADAPTER_NAME = "familysearch";

export type FamilySearchSourceFactory = (cfg: {
  apiUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
}) => FamilySearchSource;

const defaultFactory: FamilySearchSourceFactory = (cfg) =>
  new FamilySearchAdapter({
    name: FAMILYSEARCH_ADAPTER_NAME,
    version: "1.0.0",
    ...cfg,
  }) as unknown as FamilySearchSource;

export function registerFamilySearchFromEnv(
  registry: AdapterRegistry,
  env: NodeJS.ProcessEnv = process.env,
  log: Pick<Console, "info" | "warn"> = console,
  factory: FamilySearchSourceFactory = defaultFactory
): boolean {
  const apiKey = env.FAMILYSEARCH_API_KEY?.trim();
  if (!apiKey) {
    log.warn(
      "[familysearch] FAMILYSEARCH_API_KEY not set; adapter not registered, /execute/familysearch will return 404"
    );
    return false;
  }

  const source = factory({
    apiUrl: env.FAMILYSEARCH_API_URL?.trim() || "https://api.familysearch.org",
    apiKey,
    timeout: Number(env.FAMILYSEARCH_TIMEOUT_MS) || 10000,
    retries: Number(env.FAMILYSEARCH_RETRIES) || 2,
  });

  registry.register(
    FAMILYSEARCH_ADAPTER_NAME,
    new FamilySearchRouteAdapter(
      { name: FAMILYSEARCH_ADAPTER_NAME, version: "1.0.0", timeout: 10000, retries: 1 },
      source
    )
  );
  log.info("[familysearch] adapter registered");
  return true;
}
