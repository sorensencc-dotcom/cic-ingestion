import { AdapterRegistry } from "../adapters/AdapterRegistry";
import { FamilySearchAdapter } from "../adapters/familysearch/FamilySearchAdapter";
import {
  FamilySearchRouteAdapter,
  FamilySearchSource,
} from "../adapters/FamilySearchRouteAdapter";

import { MIN_ROUTE_KEY_LENGTH, ROUTE_KEY_ENV } from "../routes/execute";

export const FAMILYSEARCH_ADAPTER_NAME = "familysearch";

export type FamilySearchSourceFactory = (env: NodeJS.ProcessEnv) => FamilySearchSource;

const defaultFactory: FamilySearchSourceFactory = (env) => FamilySearchAdapter.fromEnv(env);

export function registerFamilySearchFromEnv(
  registry: AdapterRegistry,
  env: NodeJS.ProcessEnv = process.env,
  log: Pick<Console, "info" | "warn"> = console,
  factory: FamilySearchSourceFactory = defaultFactory
): boolean {
  const appKey = env.FAMILYSEARCH_APP_KEY?.trim();
  const hasToken =
    Boolean(env.FAMILYSEARCH_ACCESS_TOKEN?.trim()) ||
    Boolean(env.FAMILYSEARCH_REFRESH_TOKEN?.trim());
  if (!appKey || !hasToken) {
    log.warn(
      "[familysearch] FAMILYSEARCH_APP_KEY and FAMILYSEARCH_ACCESS_TOKEN (or FAMILYSEARCH_REFRESH_TOKEN) not set; adapter not registered, /execute/familysearch will return 404"
    );
    return false;
  }

  if ((env[ROUTE_KEY_ENV]?.trim().length ?? 0) < MIN_ROUTE_KEY_LENGTH) {
    log.warn(
      `[familysearch] ${ROUTE_KEY_ENV} (at least ${MIN_ROUTE_KEY_LENGTH} characters) not set; the route is unauthenticated, so the adapter is not registered`
    );
    return false;
  }

  let source: FamilySearchSource;
  try {
    source = factory(env);
  } catch (error) {
    log.warn(
      `[familysearch] adapter not registered: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }

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
