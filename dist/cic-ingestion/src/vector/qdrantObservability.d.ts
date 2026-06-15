import QdrantClient from "./qdrantClient.js";
export interface QdrantHealthSummary {
    collection: string;
    healthy: boolean;
}
export interface QdrantCollectionMetrics {
    collection: string;
    healthy: boolean;
    pointCount: number | null;
    indexStatus: string | null;
    lastSearchLatencyMs: number | null;
    lastIndexLatencyMs: number | null;
}
export declare class QdrantObservability {
    #private;
    constructor(client: QdrantClient);
    recordSearchLatency(ms: number): void;
    recordIndexLatency(ms: number): void;
    healthSummary(): Promise<QdrantHealthSummary>;
    metrics(): Promise<QdrantCollectionMetrics>;
}
export default QdrantObservability;
//# sourceMappingURL=qdrantObservability.d.ts.map