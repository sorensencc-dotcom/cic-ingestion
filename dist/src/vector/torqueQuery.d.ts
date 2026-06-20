import QdrantClient from "./qdrantClient.js";
import QdrantObservability from "./qdrantObservability.js";
export interface TorqueQueryRequest {
    vector: number[];
    limit: number;
}
export interface TorqueQueryHit {
    id: string;
    score: number;
    payload: Record<string, unknown> | null;
}
export declare class TorqueQueryEngine {
    #private;
    constructor(client: QdrantClient, observability?: QdrantObservability);
    search(req: TorqueQueryRequest): Promise<TorqueQueryHit[]>;
}
export default TorqueQueryEngine;
//# sourceMappingURL=torqueQuery.d.ts.map