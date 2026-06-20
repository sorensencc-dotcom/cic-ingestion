#!/usr/bin/env node
/**
 * init-qdrant.ts
 * Provision vector collections and payload indexes in Qdrant.
 */

import QdrantClient from "../vector/qdrantClient.js";

async function main() {
  if (!process.env.QDRANT_URL && process.env.NODE_ENV !== "development") {
    console.error("init-qdrant: QDRANT_URL is required in non-development environments");
    process.exit(1);
  }

  const url = process.env.QDRANT_URL || "http://localhost:6333";
  const apiKey = process.env.QDRANT_API_KEY || undefined;

  const collections = [
    { name: process.env.QDRANT_COLLECTION_CHUNKS || "cic_chunks", size: Number(process.env.QDRANT_VECTOR_SIZE || 1536) },
    { name: process.env.QDRANT_COLLECTION_CONTEXT || "cic_context", size: Number(process.env.QDRANT_VECTOR_SIZE || 1536) },
    { name: process.env.QDRANT_COLLECTION_SKILLS || "cic_vertical_skills", size: Number(process.env.QDRANT_VECTOR_SIZE || 1536) },
  ];

  for (const c of collections) {
    const client = new QdrantClient({
      url,
      apiKey,
      collection: c.name,
      vectorSize: c.size,
    });

    console.log(`init-qdrant: ensuring collection ${c.name}`);
    await client.ensureCollection();

    // Create payload indexes if this is the chunks collection
    if (c.name === (process.env.QDRANT_COLLECTION_CHUNKS || "cic_chunks")) {
      const keywordFields = ["doc_id", "chunk_id", "source_path", "tags", "people", "places"];
      for (const field of keywordFields) {
        console.log(`init-qdrant: creating keyword index for field '${field}' on ${c.name}`);
        try {
          await client.createFieldIndex(field, "keyword");
        } catch (err) {
          console.warn(`init-qdrant: index creation for field '${field}' failed or already exists:`, err);
        }
      }

      console.log(`init-qdrant: creating integer index for field 'timestamp' on ${c.name}`);
      try {
        await client.createFieldIndex("timestamp", "integer");
      } catch (err) {
        console.warn(`init-qdrant: index creation for field 'timestamp' failed or already exists:`, err);
      }
    }
  }

  console.log("init-qdrant: done");
}

main().catch((err) => {
  console.error("init-qdrant: error", err);
  process.exit(1);
});


