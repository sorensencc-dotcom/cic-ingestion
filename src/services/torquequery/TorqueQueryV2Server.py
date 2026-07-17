"""
TorqueQuery v2 — the memory/drift semantic search service (CIC + MAAL).
Supports fast-path (no MMR) and slow-path (full MMR/RRF).

This is explicitly NOT the same service as the documentation-RAG service
also informally called "TorqueQuery" in a different repo. No naming/owner
decision has been made across the two services as of this writing; see
docs/meta/phases/torquequery-reconciliation-charter.md in the main
C:/dev repo for the pending Tier 1 decision. This module makes no claim to be
"the" TorqueQuery.

IMPORTANT — architecture reality check: compute_embedding() and the
fast_path_search()/full_search() scoring functions below are a
determinism-math simulation, not a working search engine. There is no
real corpus, vector store, or encoder behind this service today. See
HARDENING-NOTES.md and CANARY-VERIFICATION-2026-07-17.md in this directory
for a full account of what is and isn't real, and a documented determinism
gap in the fast-path branch when callers supply their own embedding.

File: TorqueQueryV2Server.py
Date: 2026-07-02
Semver: 2.0.0
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import json
import logging
import os

# ========== Logging ==========

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger(__name__)

# ========== Schemas ==========

class SearchRequest(BaseModel):
    query: str
    normalized_embedding: Optional[List[float]] = None
    top_k: int = 10
    fast_path: bool = False
    skip_mmr: bool = False
    candidate_pool: int = 50
    filters: Optional[dict] = None

class SearchResult(BaseModel):
    id: str
    score: float
    metadata: dict

class SearchResponse(BaseModel):
    results: List[SearchResult]
    fast_path_used: bool
    query: str
    candidate_pool: int

# ========== Search Logic ==========

def compute_embedding(text: str) -> np.ndarray:
    """Deterministic embedding computation (placeholder for real encoder)."""
    # In production: use sentence-transformers or similar
    np.random.seed(hash(text) % (2**32))
    return np.random.rand(4096)

def fast_path_search(embedding: np.ndarray, candidate_pool: int, top_k: int) -> List[SearchResult]:
    """Fast-path: deterministic top-k without MMR/diversity scoring."""
    # Simulate candidate scoring (deterministic by embedding seed)
    scores = np.random.rand(candidate_pool)
    idx = np.argsort(scores)[::-1][:top_k]

    results = []
    for i, doc_idx in enumerate(idx):
        results.append(SearchResult(
            id=f"doc-{doc_idx:06d}",
            score=float(scores[doc_idx]),
            metadata={"rank": i, "path": f"corpus/doc-{doc_idx:06d}.json"}
        ))

    return results

def full_search(embedding: np.ndarray, candidate_pool: int, top_k: int) -> List[SearchResult]:
    """Full-path: deterministic MMR/RRF with diversity scoring."""
    # Simulate full MMR pipeline
    scores = np.random.rand(candidate_pool)
    diversity = np.random.rand(candidate_pool) * 0.1
    final = scores - diversity
    idx = np.argsort(final)[::-1][:top_k]

    results = []
    for i, doc_idx in enumerate(idx):
        results.append(SearchResult(
            id=f"doc-{doc_idx:06d}",
            score=float(final[doc_idx]),
            metadata={
                "rank": i,
                "path": f"corpus/doc-{doc_idx:06d}.json",
                "mmr_score": float(scores[doc_idx]),
                "diversity_penalty": float(diversity[doc_idx])
            }
        ))

    return results

# ========== FastAPI App ==========

app = FastAPI(title="TorqueQuery v2", version="2.0.0")

SERVICE_IDENTITY = "torquequery-memory-drift-search"


def _self_test_dependencies() -> dict:
    """
    Cheap, in-process checks of the things this service actually depends on.
    No network calls, no filesystem I/O, no claims about infrastructure
    this service doesn't have (there is no vector store or corpus to ping).
    """
    checks = {}

    try:
        _ = np.random.rand(4)
        checks["numpy"] = "ok"
    except Exception as e:  # pragma: no cover - defensive
        checks["numpy"] = f"error: {e}"

    try:
        _ = SearchRequest(query="healthcheck-selftest")
        checks["pydantic_schema"] = "ok"
    except Exception as e:  # pragma: no cover - defensive
        checks["pydantic_schema"] = f"error: {e}"

    return checks


@app.get("/health")
def health():
    """
    Single source of truth for "is this service alive and internally
    consistent." Deliberately does NOT report a fake "vector store:
    connected" — there is no vector store. Fields below describe the
    actual current architecture, including known determinism caveats.
    """
    dep_checks = _self_test_dependencies()
    healthy = all(v == "ok" for v in dep_checks.values())

    hash_seed_env = os.environ.get("PYTHONHASHSEED")
    hash_seed_pinned = hash_seed_env not in (None, "", "random")

    return {
        "status": "ok" if healthy else "degraded",
        "version": "2.0.0",
        "service": SERVICE_IDENTITY,
        "service_description": (
            "the memory/drift semantic search service (CIC + MAAL); "
            "distinct from the documentation-RAG service also informally "
            "called TorqueQuery in a different repo"
        ),
        "dependency_checks": dep_checks,
        "backing_store": "simulated",
        "embedding_backend": "simulated-deterministic-hash-seed",
        "determinism": {
            "hash_seed_pinned": hash_seed_pinned,
            "note": (
                "compute_embedding() seeds numpy's RNG from hash(text) % 2**32. "
                "Python's str hash is randomized per process unless PYTHONHASHSEED "
                "is fixed, so determinism holds only within a single running "
                "process/session, not across restarts, unless hash_seed_pinned "
                "is true. Separately: when a caller supplies normalized_embedding "
                "directly (the real fast-path call pattern used by "
                "TorqueQueryClient.ts / torqueQueryV2.ts), compute_embedding() is "
                "never invoked and no seeding occurs in that branch at all -- "
                "fast-path results then depend on whatever global numpy RNG state "
                "happens to be ambient, and are NOT guaranteed deterministic "
                "across repeated identical calls once other requests interleave. "
                "See CANARY-VERIFICATION-2026-07-17.md for a reproduced example."
            ),
        },
    }

@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    """
    Deterministic semantic search with fast-path and slow-path support.

    Fast-path is used only if:
    - req.fast_path == True
    - req.normalized_embedding is provided
    - req.skip_mmr == True

    Otherwise, full MMR/RRF slow-path is used.
    """

    try:
        # Step 1: Embedding selection
        if req.normalized_embedding:
            embedding = np.array(req.normalized_embedding)
            logger.info(json.dumps({
                "event": "search_embedding_source",
                "source": "provided_normalized",
                "embedding_dim": len(embedding)
            }))
        else:
            embedding = compute_embedding(req.query)
            logger.info(json.dumps({
                "event": "search_embedding_source",
                "source": "computed",
                "embedding_dim": len(embedding)
            }))

        # Step 2: Fast-path eligibility check (deterministic)
        fast_path_eligible = (
            req.fast_path and
            req.normalized_embedding is not None and
            req.skip_mmr is True
        )

        # Step 3: Execute search
        if fast_path_eligible:
            results = fast_path_search(embedding, req.candidate_pool, req.top_k)
            logger.info(json.dumps({
                "event": "search_executed",
                "path": "fast",
                "query": req.query,
                "top_k": req.top_k,
                "candidate_pool": req.candidate_pool,
                "result_count": len(results)
            }))
            return SearchResponse(
                results=results,
                fast_path_used=True,
                query=req.query,
                candidate_pool=req.candidate_pool
            )

        # Slow-path fallback
        results = full_search(embedding, req.candidate_pool, req.top_k)
        logger.info(json.dumps({
            "event": "search_executed",
            "path": "full",
            "query": req.query,
            "top_k": req.top_k,
            "candidate_pool": req.candidate_pool,
            "result_count": len(results)
        }))
        return SearchResponse(
            results=results,
            fast_path_used=False,
            query=req.query,
            candidate_pool=req.candidate_pool
        )

    except Exception as e:
        logger.error(json.dumps({
            "event": "search_error",
            "error": str(e),
            "query": req.query
        }))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-search")
def batch_search(requests: List[SearchRequest]):
    """Batch search for multiple queries."""
    results = []
    for req in requests:
        try:
            result = search(req)
            results.append(result)
        except HTTPException as e:
            logger.error(f"Batch search error: {e}")

    return {"results": results, "count": len(results)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
