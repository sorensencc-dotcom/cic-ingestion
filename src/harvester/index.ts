// cic-ingestion/src/harvester/index.ts
// semver: 0.1.0
// date: 2026-06-29

import { clientSessionExtractor } from "../extractors/clientSessionExtractor.js";

export const extractorMap: Record<string, Function> = {
  client_session: clientSessionExtractor,
};
