// Phase 2: Harvester v2 - Cost delta extraction & telemetry pipeline
// Extracts: build logs, cost deltas, resource spikes, phase timing, constraint violations, approval latency
// Transforms: normalize to phase telemetry schema, apply decay, correlate with cost model
// Emits: MemoryStore (cost deltas), Autonomy API (scheduler feedback)
export class HarvesterV2 {
    constructor(config) {
        this.buildLogs = [];
        this.resourceSpikes = [];
        this.config = config;
    }
    async extractBuildLogs() {
        // Simulate build log extraction from a source (in prod: read from file/API)
        // For testing: return default metrics
        const phaseIds = ['Phase 0.7', 'Phase 1', 'Phase 2', 'Phase 24'];
        const logs = phaseIds.map(phaseId => ({
            phaseId,
            startTime: Date.now() - Math.random() * 3600000,
            endTime: Date.now(),
            cpuPeak: 2 + Math.random() * 6,
            memoryPeak: 4 + Math.random() * 12,
            diskBytesWritten: 100000 + Math.random() * 900000,
            status: Math.random() > 0.1 ? 'success' : 'failure',
        }));
        this.buildLogs = logs;
        return logs;
    }
    async extractCostDeltas() {
        if (this.buildLogs.length === 0) {
            await this.extractBuildLogs();
        }
        return this.buildLogs.map(log => ({
            phaseId: log.phaseId,
            actualCost: this.computeActualCost(log),
            plannedCost: this.getPlannedCost(log.phaseId),
            variance: 0, // Computed later
            resourceUtilization: {
                cpu: log.cpuPeak,
                memory: log.memoryPeak,
                disk: log.diskBytesWritten,
            },
            duration: log.endTime - log.startTime,
            timestamp: log.endTime,
        }));
    }
    async extractResourceSpikes() {
        if (this.buildLogs.length === 0) {
            await this.extractBuildLogs();
        }
        const spikes = [];
        for (const log of this.buildLogs) {
            if (log.cpuPeak > 7) {
                spikes.push({
                    phaseId: log.phaseId,
                    resourceType: 'cpu',
                    value: log.cpuPeak,
                    timestamp: log.endTime,
                });
            }
            if (log.memoryPeak > 14) {
                spikes.push({
                    phaseId: log.phaseId,
                    resourceType: 'memory',
                    value: log.memoryPeak,
                    timestamp: log.endTime,
                });
            }
        }
        this.resourceSpikes = spikes;
        return spikes;
    }
    async normalizeTelemetry(_raw) {
        const deltas = await this.extractCostDeltas();
        return deltas.map(delta => ({
            ...delta,
            variance: delta.actualCost - delta.plannedCost,
        }));
    }
    async emitToMemory(metrics) {
        if (!this.config.memoryStore)
            return;
        for (const metric of metrics) {
            if (typeof this.config.memoryStore.append === 'function') {
                await this.config.memoryStore.append({
                    event_type: 'PHASE_EXECUTION',
                    phaseId: metric.phaseId,
                    actualCost: metric.actualCost,
                    plannedCost: metric.plannedCost,
                    variance: metric.variance,
                    resourceUtilization: metric.resourceUtilization,
                    duration: metric.duration,
                    timestamp: metric.timestamp,
                });
            }
        }
    }
    async emitToScheduler(metrics) {
        if (!this.config.metricsEndpoint)
            return;
        try {
            const payload = {
                metrics,
                timestamp: Date.now(),
                source: 'harvester-v2',
            };
            // Simulate posting to scheduler API
            // In prod: use fetch(this.config.metricsEndpoint, { method: 'POST', body: JSON.stringify(payload) })
            console.log('[HarvesterV2] Emitting to scheduler:', payload);
        }
        catch (err) {
            console.error('[HarvesterV2] Failed to emit to scheduler:', err);
        }
    }
    async run() {
        // Full pipeline: extract → transform → emit
        const logs = await this.extractBuildLogs();
        const spikes = await this.extractResourceSpikes();
        const metrics = await this.normalizeTelemetry(logs);
        await this.emitToMemory(metrics);
        await this.emitToScheduler(metrics);
    }
    computeActualCost(log) {
        // Simple cost model: CPU hours + Memory hours + Disk I/O
        const duration = (log.endTime - log.startTime) / 3600000; // hours
        const cpuCost = log.cpuPeak * duration * 0.1;
        const memoryCost = log.memoryPeak * duration * 0.05;
        const diskCost = (log.diskBytesWritten / 1e9) * 0.01; // per GB written
        return cpuCost + memoryCost + diskCost;
    }
    getPlannedCost(phaseId) {
        // Default planned costs for known phases
        const plannedCosts = {
            'Phase 0.7': 12.5,
            'Phase 1': 25.0,
            'Phase 2': 20.0,
            'Phase 24': 15.0,
        };
        return plannedCosts[phaseId] || 20.0;
    }
}
//# sourceMappingURL=HarvesterV2.js.map