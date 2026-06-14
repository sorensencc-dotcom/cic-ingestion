# CIC Vector Subsystem

Production-grade vector subsystem for CIC, backed by Qdrant.

## Overview

The Vector subsystem provides:

- Chunk indexing from Harvester
- Semantic search via TorqueQuery
- SUPER BOB context storage
- Skills retrieval
- Health and self-healing

## Components

- `QdrantClient` — low-level client
- `HarvesterIndexer` — writes chunks to `cic_chunks`
- `ContextStoreWriter` — writes context to `cic_context`
- `TorqueQueryPlanner` — multi-collection query planner
- `VectorLayer` — orchestrator for chunks/context/skills
- `VectorSelfHealer` — periodic health + remediation
- `vectorRoutes` — HTTP API
- `index.ts` — wiring hub

## Environment Variables

- `QDRANT_URL` — Qdrant base URL (e.g. `http://qdrant:6333`)
- `QDRANT_API_KEY` — optional API key
- `QDRANT_COLLECTION_CHUNKS` — default `cic_chunks`
- `QDRANT_COLLECTION_CONTEXT` — default `cic_context`
- `QDRANT_COLLECTION_SKILLS` — default `cic_vertical_skills`
- `QDRANT_VECTOR_SIZE` — default `1536`

## HTTP API

### `POST /vector/index`

Index a single chunk.

Body:

```json
{
  "id": "chunk-1",
  "docId": "doc-1",
  "sourcePath": "/path/file.txt",
  "timestamp": 1718300000,
  "tags": ["tag"],
  "people": [],
  "places": [],
  "metadata": {},
  "text": "chunk text",
  "vector": [0.1, 0.2, ...]
}
```

### `POST /vector/search`

Search chunks.

Body:

```json
{
  "vector": [0.1, 0.2, ...],
  "limit": 10
}
```

Response:

```json
{
  "ok": true,
  "hits": [
    {
      "id": "chunk-1",
      "score": 0.98,
      "payload": { ... }
    }
  ]
}
```

### `POST /vector/context/write`

Write a context item.

Body:

```json
{
  "id": "ctx-1",
  "vector": [0.1, 0.2, ...],
  "summary": "summary text",
  "kind": "summary",
  "docId": "doc-1",
  "metadata": {}
}
```

### `GET /vector/health`

Service health.

Response:

```json
{
  "ok": true,
  "health": {
    "chunks": true,
    "context": true,
    "skills": true
  }
}
```

## Running Locally

To run collection initialization:
```bash
node dist/scripts/init-qdrant.js
```

## Operator Notes

- No hidden retries; failures are explicit.
- Collections are ensured on startup.
- Self-healing re-ensures collections if health fails.
- Logs are structured JSON via Node console.
