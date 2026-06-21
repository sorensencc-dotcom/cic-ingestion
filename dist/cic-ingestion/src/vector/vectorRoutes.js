/**
 * vectorRoutes.ts
 * HTTP routes exposing VectorLayer.
 */
import express from "express";
export function createVectorRouter(layer) {
    const router = express.Router();
    router.post("/vector/index", async (req, res) => {
        try {
            const chunk = req.body;
            await layer.chunks.indexer.indexChunk(chunk);
            res.status(200).json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: String(err) });
        }
    });
    router.post("/vector/search", async (req, res) => {
        try {
            const { vector, limit } = req.body;
            const hits = await layer.chunks.search.search({ vector, limit });
            res.status(200).json({ ok: true, hits });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: String(err) });
        }
    });
    router.post("/vector/context/write", async (req, res) => {
        try {
            const item = req.body;
            await layer.context.writer.write(item);
            res.status(200).json({ ok: true });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: String(err) });
        }
    });
    router.get("/vector/health", async (_req, res) => {
        try {
            const health = await layer.health();
            res.status(200).json({ ok: true, health });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: String(err) });
        }
    });
    router.get("/vector/metrics", async (_req, res) => {
        try {
            const chunks = await layer.chunks.observability.metrics();
            const context = await layer.context.observability.metrics();
            const skills = await layer.skills.observability.metrics();
            res.status(200).json({ ok: true, chunks, context, skills });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: String(err) });
        }
    });
    router.post("/vector/debug/torque-query", async (req, res) => {
        try {
            const { vectorPrimary, vectorSecondary, limit, collections, facets } = req.body;
            const resolvedCollections = (collections || []).map((col) => {
                const name = typeof col === "string" ? col : col.name;
                if (name === "chunks")
                    return { name: "chunks", client: layer.chunks.client };
                if (name === "context")
                    return { name: "context", client: layer.context.client };
                if (name === "skills")
                    return { name: "skills", client: layer.skills.client };
                throw new Error(`Unknown collection: ${name}`);
            });
            const result = await layer.planner.execute({
                vectorPrimary,
                vectorSecondary,
                limit,
                collections: resolvedCollections,
                facets,
            });
            res.status(200).json({
                ok: true,
                hits: result.hits,
                facets: result.facets,
                debug: result.debug,
            });
        }
        catch (err) {
            res.status(500).json({ ok: false, error: String(err) });
        }
    });
    return router;
}
//# sourceMappingURL=vectorRoutes.js.map
