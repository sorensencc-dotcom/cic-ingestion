// Phase 2: Harvester v2 - Cost delta extraction & telemetry pipeline
// Extracts: build logs, cost deltas, resource spikes, phase timing, constraint violations, approval latency
// Transforms: normalize to phase telemetry schema, apply decay, correlate with cost model
// Emits: MemoryStore (cost deltas), Autonomy API (scheduler feedback)
export class HarvesterV2 {
    constructor(config) {
        this._config = config;
    }
    // Extractor: build logs
    extractBuildLogs() {
        throw new Error('Not implemented');
    }
    // Extractor: cost deltas
    extractCostDeltas() {
        throw new Error('Not implemented');
    }
    // Extractor: resource spikes
    extractResourceSpikes() {
        throw new Error('Not implemented');
    }
    // Transformer: normalize telemetry
    normalizeTelemetry(_raw) {
        throw new Error('Not implemented');
    }
    // Emitter: to MemoryStore
    emitToMemory(_metrics) {
        throw new Error('Not implemented');
    }
    // Emitter: to Autonomy API (scheduler feedback)
    emitToScheduler(_metrics) {
        throw new Error('Not implemented');
    }
    // Main pipeline
    async run() {
        throw new Error('Not implemented');
    }
}
//# sourceMappingURL=HarvesterV2.js.map