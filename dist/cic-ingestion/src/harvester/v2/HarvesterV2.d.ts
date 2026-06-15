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
export declare class HarvesterV2 {
    constructor(_config: HarvesterV2Config);
    extractBuildLogs(): Promise<any[]>;
    extractCostDeltas(): Promise<PhaseMetrics[]>;
    extractResourceSpikes(): Promise<any[]>;
    normalizeTelemetry(_raw: any[]): Promise<PhaseMetrics[]>;
    emitToMemory(_metrics: PhaseMetrics[]): Promise<void>;
    emitToScheduler(_metrics: PhaseMetrics[]): Promise<void>;
    run(): Promise<void>;
}
//# sourceMappingURL=HarvesterV2.d.ts.map