/**
 * vectorLayer.ts
 * CIC Ingestion — VectorLayer Bootstrap
 * v1.0.0 — 2026-06-14
 *
 * Wires together:
 *  - QdrantClient
 *  - HarvesterIndexer
 *  - TorqueQueryEngine
 *  - TorqueQueryPlanner
 *  - ContextStoreWriter
 *  - QdrantObservability
 *
 * Provides a single, unified interface for CIC ingestion + retrieval.
 */
import QdrantClient from "./qdrantClient.js";
import HarvesterIndexer from "./harvesterIndexer.js";
import TorqueQueryEngine from "./torqueQuery.js";
import TorqueQueryPlanner from "./torqueQueryPlanner.js";
import ContextStoreWriter from "./contextStoreWriter.js";
import QdrantObservability from "./qdrantObservability.js";
export interface VectorLayerConfig {
    url: string;
    apiKey?: string;
    collections: {
        chunks: string;
        context: string;
        skills: string;
    };
    vectorSize: number;
}
export declare class VectorLayer {
    chunks: {
        client: QdrantClient;
        indexer: HarvesterIndexer;
        search: TorqueQueryEngine;
        observability: QdrantObservability;
    };
    context: {
        client: QdrantClient;
        writer: ContextStoreWriter;
        observability: QdrantObservability;
    };
    skills: {
        client: QdrantClient;
        search: TorqueQueryEngine;
        observability: QdrantObservability;
    };
    planner: TorqueQueryPlanner;
    constructor(cfg: VectorLayerConfig);
    ensureCollections(): Promise<void>;
    health(): Promise<Record<string, boolean>>;
}
export default VectorLayer;
//# sourceMappingURL=vectorLayer.d.ts.map