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
  if (!process.env.QDRANT_URL && process.env.NODE_ENV !== "development") {
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

  // Ensure collections exist
  await layer.ensureCollections();

  // Attach API routes
  const router = createVectorRouter(layer);
  app.use("/", router);

  // Start self-healing watchdog
  const healer = new VectorSelfHealer(layer, 30000);
  healer.start();

  return { layer, healer };
}


