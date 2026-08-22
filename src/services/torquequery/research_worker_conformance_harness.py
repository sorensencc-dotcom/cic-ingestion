"""
TorqueQuery Research Worker Contract-Conformance Harness.

Provides canonical request/response fixtures, conformance assertion helpers,
and a local mock worker fixture for verifying external research worker implementations
against the research.task.v1 and research.result.v1 protocol contracts.
"""

import hashlib
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Dict, Any, Optional, Callable, List
from contextlib import contextmanager


CANONICAL_SOURCE_DOC_1 = "Memory drift rate within allowable tolerance (<0.10) verified by CIC."
CANONICAL_SOURCE_DOC_2 = "Direct verification of provider fail-closed behavior across all endpoints."


def _sha256_str(val: str) -> str:
    return f"sha256:{hashlib.sha256(val.encode('utf-8')).hexdigest()}"


# ===========================================================================
# 1. Canonical Fixtures
# ===========================================================================

def get_canonical_task_request(
    task_id: str = "TASK-CONFORMANCE-001",
    run_id: str = "RUN-CONFORMANCE-001",
    kind: str = "research.compare",
    approval_required: bool = True,
    idempotency_key: str = "idem-conformance-key-123",
) -> Dict[str, Any]:
    """Returns a valid, fully-populated canonical research.task.v1 request fixture."""
    return {
        "schema": "research.task.v1",
        "task_id": task_id,
        "run_id": run_id,
        "kind": kind,
        "inputs": {
            "source_ids": ["src-doc-001", "src-doc-002"],
            "comparison_axes": ["accuracy", "drift_rate", "latency"],
        },
        "subject": {
            "entity": "governance_policy",
            "topic": "memory_drift_containment",
        },
        "constraints": {
            "max_citations": 10,
            "min_confidence": 0.85,
            "timeout_seconds": 30,
        },
        "idempotency_key": idempotency_key,
        "requested_by": "agent-cic-evaluator",
        "output_contract": "research.result.v1",
        "approval_required": approval_required,
        "instruction": "Compare memory drift patterns across baseline and candidate revisions.",
        "success_criteria": [
            "Identify all drift regressions with confidence >= 0.85",
            "Provide file and character span citations for all claims",
        ],
    }


def get_canonical_result_response(
    task_id: str = "TASK-CONFORMANCE-001",
    run_id: str = "RUN-CONFORMANCE-001",
    status: str = "completed",
    requires_approval: bool = True,
    provider_name: str = "conformance-worker-ref",
    source_1_text: str = CANONICAL_SOURCE_DOC_1,
    source_2_text: str = CANONICAL_SOURCE_DOC_2,
) -> Dict[str, Any]:
    """
    Returns a valid canonical research.result.v1 response fixture adhering to
    research/citation.v1 schema (integer start, integer end, sha256 span_hash)
    and TRM cross-validator resolver specifications.
    """
    span_1_slice = source_1_text[0:45]
    span_2_slice = source_2_text[0:53]

    return {
        "schema": "research.result.v1",
        "task_id": task_id,
        "run_id": run_id,
        "attempt_id": "att-conformance-1",
        "status": status,
        "producer": {
            "engine": "torquequery-worker",
            "provider": provider_name,
            "model": "conformance-eval-v1",
            "prompt_version": "v1.0.0",
        },
        "payload": {
            "target_claim_ids": ["claim-drift-001", "claim-drift-002"],
            "findings": [
                {
                    "type": "observation",
                    "source_id": "src-doc-001",
                    "source_revision": _sha256_str(source_1_text),
                    "source_span": {
                        "start": 0,
                        "end": 45,
                        "span_hash": _sha256_str(span_1_slice),
                    },
                    "confidence": 0.92,
                    "rationale": "Memory drift rate within allowable tolerance (<0.10).",
                },
                {
                    "type": "observation",
                    "source_id": "src-doc-002",
                    "source_revision": _sha256_str(source_2_text),
                    "source_span": {
                        "start": 0,
                        "end": 53,
                        "span_hash": _sha256_str(span_2_slice),
                    },
                    "confidence": 0.89,
                    "rationale": "Direct verification of provider fail-closed behavior.",
                },
            ],
        },
        "requires_approval": requires_approval,
    }


# ===========================================================================
# 2. Conformance Mock Worker Server Fixture
# ===========================================================================

class ConformanceWorkerServer:
    """Configurable local HTTP server for testing worker contract conformance."""
    def __init__(self, host: str = "127.0.0.1", port: int = 0):
        self.host = host
        self.port = port
        self.received_requests: List[Dict[str, Any]] = []
        self.handler_fn: Optional[Callable[[Dict[str, Any], BaseHTTPRequestHandler], None]] = None
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None

    def start(self):
        worker = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                content_len = int(self.headers.get("Content-Length", 0))
                raw_body = self.rfile.read(content_len)
                
                try:
                    payload = json.loads(raw_body.decode("utf-8"))
                except Exception:
                    payload = {"_raw_body": raw_body.decode("utf-8", errors="replace")}
                
                worker.received_requests.append(payload)

                if worker.handler_fn:
                    worker.handler_fn(payload, self)
                else:
                    # Default: return canonical matching response
                    task_id = payload.get("task_id", "UNKNOWN_TASK")
                    run_id = payload.get("run_id", "UNKNOWN_RUN")
                    resp = get_canonical_result_response(
                        task_id=task_id,
                        run_id=run_id,
                        requires_approval=payload.get("approval_required", True),
                    )
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(resp).encode("utf-8"))

            def log_message(self, format, *args):
                pass  # Suppress console noise during test runs

        self._server = HTTPServer((self.host, self.port), Handler)
        self.host, self.port = self._server.server_address
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}/tasks"

    def stop(self):
        if self._server:
            self._server.shutdown()
            self._server.server_close()
            self._server = None


@contextmanager
def local_worker_conformance_context(handler_fn: Optional[Callable] = None):
    """Context manager yielding a running local ConformanceWorkerServer."""
    server = ConformanceWorkerServer()
    if handler_fn:
        server.handler_fn = handler_fn
    server.start()
    try:
        yield server
    finally:
        server.stop()
