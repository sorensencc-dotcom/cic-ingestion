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
export class VectorLayer {
    constructor(cfg) {
        //
        // ────────────────────────────────────────────────────────────────
        //   cic_chunks collection
        // ────────────────────────────────────────────────────────────────
        //
        const chunksClient = new QdrantClient({
            url: cfg.url,
            apiKey: cfg.apiKey,
            collection: cfg.collections.chunks,
            vectorSize: cfg.vectorSize,
        });
        const chunksObs = new QdrantObservability(chunksClient);
        this.chunks = {
            client: chunksClient,
            indexer: new HarvesterIndexer(chunksClient, chunksObs),
            search: new TorqueQueryEngine(chunksClient, chunksObs),
            observability: chunksObs,
        };
        //
        // ────────────────────────────────────────────────────────────────
        //   cic_context collection
        // ────────────────────────────────────────────────────────────────
        //
        const contextClient = new QdrantClient({
            url: cfg.url,
            apiKey: cfg.apiKey,
            collection: cfg.collections.context,
            vectorSize: cfg.vectorSize,
        });
        this.context = {
            client: contextClient,
            writer: new ContextStoreWriter(contextClient),
            observability: new QdrantObservability(contextClient),
        };
        //
        // ────────────────────────────────────────────────────────────────
        //   cic_vertical_skills collection
        // ────────────────────────────────────────────────────────────────
        //
        const skillsClient = new QdrantClient({
            url: cfg.url,
            apiKey: cfg.apiKey,
            collection: cfg.collections.skills,
            vectorSize: cfg.vectorSize,
        });
        const skillsObs = new QdrantObservability(skillsClient);
        this.skills = {
            client: skillsClient,
            search: new TorqueQueryEngine(skillsClient, skillsObs),
            observability: skillsObs,
        };
        this.planner = new TorqueQueryPlanner({
            chunks: { name: "chunks", client: chunksClient },
            context: { name: "context", client: contextClient },
            skills: { name: "skills", client: skillsClient },
        });
    }
    //
    // ────────────────────────────────────────────────────────────────
    //   Lifecycle
    // ────────────────────────────────────────────────────────────────
    //
    async ensureCollections() {
        await this.chunks.client.ensureCollection();
        await this.context.client.ensureCollection();
        await this.skills.client.ensureCollection();
    }
    async health() {
        return {
            chunks: await this.chunks.observability.healthSummary().then(h => h.healthy),
            context: await this.context.observability.healthSummary().then(h => h.healthy),
            skills: await this.skills.observability.healthSummary().then(h => h.healthy),
        };
    }
}
export default VectorLayer;
//# sourceMappingURL=vectorLayer.js.map
