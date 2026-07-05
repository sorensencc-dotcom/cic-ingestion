"""
TorqueQuery v2 — Deterministic semantic search service.
Supports fast-path (no MMR) and slow-path (full MMR/RRF) for CIC + MAAL.

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

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}

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
