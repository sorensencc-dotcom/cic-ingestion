/**
 * vectorRoutes.ts
 * HTTP routes exposing VectorLayer.
 */

import express from "express";
import VectorLayer from "./vectorLayer.js";

export function createVectorRouter(layer: VectorLayer) {
  const router = express.Router();

  router.post("/vector/index", async (req, res) => {
    try {
      const chunk = req.body;
      await layer.chunks.indexer.indexChunk(chunk);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  router.post("/vector/search", async (req, res) => {
    try {
      const { vector, limit } = req.body;
      const hits = await layer.chunks.search.search({ vector, limit });
      res.status(200).json({ ok: true, hits });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  router.post("/vector/context/write", async (req, res) => {
    try {
      const item = req.body;
      await layer.context.writer.write(item);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  router.get("/vector/health", async (_req, res) => {
    try {
      const health = await layer.health();
      res.status(200).json({ ok: true, health });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  return router;
}
