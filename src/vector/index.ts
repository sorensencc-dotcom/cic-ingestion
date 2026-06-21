/**
 * index.ts
 * CIC Vector Subsystem Wiring Hub
 * v1.0.0 — 2026-06-14
 *
 * Wires:
 *  - VectorLayer
 *  - API routes
 *  - Self-healing
 */

import VectorLayer from "./vectorLayer.js";
import { createVectorRouter } from "./vectorRoutes.js";
import { VectorSelfHealer } from "./vectorSelfHealing.js";

export async function wireVectorLayer(app: any) {
  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

  if (!process.env.QDRANT_URL && !isDev) {
    throw new Error("QDRANT_URL is required in non-development environments");
  }

  const url = process.env.QDRANT_URL || "http://localhost:6333";

  const layer = new VectorLayer({
    url,
    apiKey: process.env.QDRANT_API_KEY || undefined,
    collections: {
      chunks: process.env.QDRANT_COLLECTION_CHUNKS || "cic_chunks",
      context: process.env.QDRANT_COLLECTION_CONTEXT || "cic_context",
      skills: process.env.QDRANT_COLLECTION_SKILLS || "cic_vertical_skills",
    },
    vectorSize: Number(process.env.QDRANT_VECTOR_SIZE || 1536),
  });

  try {
    // Ensure collections exist
    await layer.ensureCollections();

    // Attach API routes
    const router = createVectorRouter(layer);
    app.use("/", router);

    // Start self-healing watchdog
    const healer = new VectorSelfHealer(layer, 30000);
    healer.start();

    return { layer, healer };
  } catch (err) {
    // In development, log warning but continue without vector layer
    if (isDev) {
      console.warn("⚠ Vector layer initialization failed (continuing in degraded mode):", (err as Error).message);
      return { layer: null, healer: null };
    }
    throw err;
  }
}


