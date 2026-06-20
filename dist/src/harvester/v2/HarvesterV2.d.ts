export interface PhaseMetrics {
    phaseId: string;
    actualCost: number;
    plannedCost: number;
    variance: number;
    resourceUtilization: Record<string, number>;
    duration: number;
    timestamp: number;
}
export interface HarvesterV2Config {
    buildLogPath: string;
    metricsEndpoint: string;
    vaultStore: any;
    memoryStore: any;
}
interface BuildLog {
    phaseId: string;
    startTime: number;
    endTime: number;
    cpuPeak: number;
    memoryPeak: number;
    diskBytesWritten: number;
    status: 'success' | 'failure';
}
interface ResourceSpike {
    phaseId: string;
    resourceType: 'cpu' | 'memory' | 'disk';
    value: number;
    timestamp: number;
}
export declare class HarvesterV2 {
    private config;
    private buildLogs;
    private resourceSpikes;
    constructor(config: HarvesterV2Config);
    extractBuildLogs(): Promise<BuildLog[]>;
    extractCostDeltas(): Promise<PhaseMetrics[]>;
    extractResourceSpikes(): Promise<ResourceSpike[]>;
    normalizeTelemetry(_raw: any[]): Promise<PhaseMetrics[]>;
    emitToMemory(metrics: PhaseMetrics[]): Promise<void>;
    emitToScheduler(metrics: PhaseMetrics[]): Promise<void>;
    run(): Promise<void>;
    private computeActualCost;
    private getPlannedCost;
}
export {};
//# sourceMappingURL=HarvesterV2.d.ts.map