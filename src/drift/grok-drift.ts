import { GrokProvider } from "../adapters/grok/grok-provider.js";

export async function computeGrokDocsDrift(
  grok: GrokProvider,
  baselineHash: string
) {
  const index = await grok.execute({ kind: "ingest", slugs: [] });

  const currentHash = index.lineage?.corpusHash ?? "";
  const drift = baselineHash === currentHash ? 0 : 1;

  return {
    baselineHash,
    currentHash,
    driftScore: drift,
    hasDrift: drift === 1,
  };
}
