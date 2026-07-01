// cic-ingestion/src/extractors/clientSessionExtractor.ts
// semver: 0.1.0
// date: 2026-06-29

export interface ClientSessionEntry {
  type: string;
  timestamp: number;
  backend: string;
  request: any;
  response: any;
}

export async function clientSessionExtractor(entry: ClientSessionEntry) {
  const { backend, response, timestamp } = entry;

  return {
    type: "client_session",
    backend,
    latency_ms: response?.meta?.latency_ms ?? null,
    tokens: response?.usage?.total_tokens ?? null,
    timestamp,
    driftSignals: {
      latency: response?.meta?.latency_ms,
      tokens: response?.usage?.total_tokens,
      backend,
    },
  };
}
