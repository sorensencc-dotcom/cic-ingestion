/**
 * qdrantClient.ts
 * CIC Ingestion — Qdrant Vector DB Client
 * v1.0.0 — 2026-06-14
 *
 * Deterministic, operator‑grade implementation for CIC Phase 26 (TorqueQuery).
 * No hidden retries. No silent fallbacks. Strict boundary validation.
 */
export interface QdrantPoint {
    id: string;
    vector: number[];
    payload?: Record<string, unknown>;
}
export interface QdrantQueryResult {
    id: string;
    score: number;
    payload: Record<string, unknown> | null;
}
export declare class QdrantClient {
    #private;
    constructor(opts: {
        url: string;
        apiKey?: string;
        collection: string;
        vectorSize: number;
    });
    collectionName(): string;
    get vectorSize(): number;
    ensureCollection(): Promise<void>;
    createFieldIndex(fieldName: string, fieldType: "keyword" | "integer" | "float" | "geo" | "text"): Promise<void>;
    upsert(points: QdrantPoint[]): Promise<void>;
    query(vector: number[], limit: number): Promise<QdrantQueryResult[]>;
    delete(ids: string[]): Promise<void>;
    health(): Promise<boolean>;
    stats(): Promise<{
        points_count: number;
        indexing: string;
    }>;
}
export default QdrantClient;
//# sourceMappingURL=qdrantClient.d.ts.map