import QdrantClient from "./qdrantClient.js";
export interface TorqueCollectionTarget {
    name: "chunks" | "context" | "skills";
    client: QdrantClient;
}
export interface TorqueQueryPlan {
    vectorPrimary: number[];
    vectorSecondary?: number[];
    limit: number;
    filter?: Record<string, unknown>;
    collections: TorqueCollectionTarget[];
    facets?: string[];
}
export interface TorqueQueryHit {
    id: string;
    score: number;
    payload: Record<string, unknown> | null;
    collection: string;
}
export interface TorqueQueryResponse {
    hits: TorqueQueryHit[];
    facets: Record<string, Record<string, number>>;
    debug?: any;
}
export declare class TorqueQueryPlanner {
    #private;
    constructor(targets: Record<string, TorqueCollectionTarget>);
    getTargets(): Record<string, TorqueCollectionTarget>;
    execute(plan: TorqueQueryPlan): Promise<TorqueQueryResponse>;
}
export default TorqueQueryPlanner;
//# sourceMappingURL=torqueQueryPlanner.d.ts.map