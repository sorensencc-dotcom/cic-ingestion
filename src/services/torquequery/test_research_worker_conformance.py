"""
Contract-conformance test suite for external research worker integration in TorqueQuery v2.

Covers:
1. Canonical research.task.v1 request fixture transmission and field fidelity.
2. Valid research.result.v1 response fixture and envelope validation.
3. HTTP 400/422/500 status code mapping.
4. Timeout and socket connection refusal handling.
5. task_id and run_id identity mismatch detection.
6. Malformed result envelope and citation structure handling.
7. RESEARCH_WORKER_URL environment startup, lifecycle, and fail-closed defaults.
"""

import json
import time
import pytest
from fastapi.testclient import TestClient

import TorqueQueryV2Server as torque_module
from TorqueQueryV2Server import app
from research_worker_conformance_harness import (
    get_canonical_task_request,
    get_canonical_result_response,
    local_worker_conformance_context,
)

client = TestClient(app)


# ===========================================================================
# 1. Canonical research.task.v1 Request Fixture
# ===========================================================================

def test_conformance_canonical_task_request_payload():
    """Verifies that all canonical research.task.v1 fields are transmitted intact to the worker."""
    task = get_canonical_task_request(
        task_id="TASK-CONF-REQ-001",
        run_id="RUN-CONF-REQ-001",
        kind="research.synthesize",
        approval_required=True,
        idempotency_key="idem-full-fidelity-001",
    )

    with local_worker_conformance_context() as server:
        adapter = torque_module.HttpResearchWorkerAdapter(worker_url=server.url, timeout=5.0)
        torque_module.set_research_provider(adapter)
        try:
            resp = client.post("/tasks", json=task)
            assert resp.status_code == 200
            data = resp.json()
            assert data["schema"] == "research.result.v1"
            assert data["task_id"] == "TASK-CONF-REQ-001"
            assert data["run_id"] == "RUN-CONF-REQ-001"

            # Check that worker received the full canonical request
            assert len(server.received_requests) == 1
            received = server.received_requests[0]
            assert received["schema"] == "research.task.v1"
            assert received["task_id"] == "TASK-CONF-REQ-001"
            assert received["run_id"] == "RUN-CONF-REQ-001"
            assert received["kind"] == "research.synthesize"
            assert received["inputs"]["source_ids"] == ["src-doc-001", "src-doc-002"]
            assert received["subject"]["topic"] == "memory_drift_containment"
            assert received["constraints"]["min_confidence"] == 0.85
            assert received["idempotency_key"] == "idem-full-fidelity-001"
            assert received["requested_by"] == "agent-cic-evaluator"
            assert received["output_contract"] == "research.result.v1"
            assert received["approval_required"] is True
            assert len(received["success_criteria"]) == 2
        finally:
            torque_module.reset_research_provider()


# ===========================================================================
# 2. Valid research.result.v1 Response Envelope
# ===========================================================================

def test_conformance_valid_result_response_envelope():
    """Verifies complete validation of valid research.result.v1 payload with citations."""
    task = get_canonical_task_request(
        task_id="TASK-CONF-RES-001",
        run_id="RUN-CONF-RES-001",
        approval_required=False,
    )

    def worker_handler(payload, handler):
        res = get_canonical_result_response(
            task_id="TASK-CONF-RES-001",
            run_id="RUN-CONF-RES-001",
            status="completed",
            requires_approval=False,
            provider_name="verified-conformance-provider",
        )
        handler.send_response(200)
        handler.send_header("Content-Type", "application/json")
        handler.end_headers()
        handler.wfile.write(json.dumps(res).encode("utf-8"))

    with local_worker_conformance_context(handler_fn=worker_handler) as server:
        adapter = torque_module.HttpResearchWorkerAdapter(worker_url=server.url, timeout=5.0)
        torque_module.set_research_provider(adapter)
        try:
            resp = client.post("/tasks", json=task)
            assert resp.status_code == 200
            data = resp.json()
            assert data["schema"] == "research.result.v1"
            assert data["task_id"] == "TASK-CONF-RES-001"
            assert data["run_id"] == "RUN-CONF-RES-001"
            assert data["status"] == "completed"
            assert data["requires_approval"] is False
            assert data["producer"]["provider"] == "verified-conformance-provider"
            assert data["producer"]["engine"] == "torquequery-worker"
            assert len(data["payload"]["target_claim_ids"]) == 2
            assert len(data["payload"]["findings"]) == 2

            finding_1 = data["payload"]["findings"][0]
            assert finding_1["source_id"] == "src-doc-001"
            assert finding_1["confidence"] == 0.92
            assert finding_1["source_span"]["start"] == 0
            assert finding_1["source_span"]["end"] == 45
            assert finding_1["source_span"]["span_hash"].startswith("sha256:")
            assert finding_1["source_revision"].startswith("sha256:")
        finally:
            torque_module.reset_research_provider()


# ===========================================================================
# 3. HTTP 400/422/500/503 Status Code Mapping
# ===========================================================================

@pytest.mark.parametrize("status_code,err_payload,expected_code", [
    (400, {"error": "Invalid request parameter"}, "INVALID_PROVIDER_RESULT"),
    (422, {"detail": "Unprocessable entity schema error"}, "INVALID_PROVIDER_RESULT"),
    (500, b"Internal Server Error", "PROVIDER_UNAVAILABLE"),
    (503, b"Service Unavailable", "PROVIDER_UNAVAILABLE"),
])
def test_conformance_http_error_code_mapping(status_code, err_payload, expected_code):
    """Verifies that HTTP 400/422 map to INVALID_PROVIDER_RESULT, and 500/503 map to PROVIDER_UNAVAILABLE."""
    task = get_canonical_task_request(task_id=f"TASK-ERR-{status_code}", run_id=f"RUN-ERR-{status_code}")

    def error_handler(payload, handler):
        handler.send_response(status_code)
        if isinstance(err_payload, dict):
            handler.send_header("Content-Type", "application/json")
            handler.end_headers()
            handler.wfile.write(json.dumps(err_payload).encode("utf-8"))
        else:
            handler.send_header("Content-Type", "text/plain")
            handler.end_headers()
            handler.wfile.write(err_payload)

    with local_worker_conformance_context(handler_fn=error_handler) as server:
        adapter = torque_module.HttpResearchWorkerAdapter(worker_url=server.url, timeout=5.0)
        torque_module.set_research_provider(adapter)
        try:
            resp = client.post("/tasks", json=task)
            assert resp.status_code == 502
            data = resp.json()
            assert data["detail"]["code"] == expected_code
        finally:
            torque_module.reset_research_provider()


# ===========================================================================
# 4. Timeout and Socket Connection Refusal
# ===========================================================================

def test_conformance_worker_timeout_handling():
    """Verifies that slow worker responses exceeding configured timeout return PROVIDER_UNAVAILABLE."""
    task = get_canonical_task_request(task_id="TASK-TIMEOUT-001", run_id="RUN-TIMEOUT-001")

    def hanging_handler(payload, handler):
        time.sleep(0.4)
        handler.send_response(200)
        handler.end_headers()
        handler.wfile.write(b"{}")

    with local_worker_conformance_context(handler_fn=hanging_handler) as server:
        # Tight timeout of 100ms
        adapter = torque_module.HttpResearchWorkerAdapter(worker_url=server.url, timeout=0.1)
        torque_module.set_research_provider(adapter)
        try:
            resp = client.post("/tasks", json=task)
            assert resp.status_code == 502
            assert resp.json()["detail"]["code"] == "PROVIDER_UNAVAILABLE"
        finally:
            torque_module.reset_research_provider()


def test_conformance_socket_connection_refusal():
    """Verifies that unreachable or closed ports return PROVIDER_UNAVAILABLE without crashing."""
    task = get_canonical_task_request(task_id="TASK-REFUSAL-001", run_id="RUN-REFUSAL-001")
    adapter = torque_module.HttpResearchWorkerAdapter(worker_url="http://127.0.0.1:59997/tasks", timeout=0.5)
    torque_module.set_research_provider(adapter)
    try:
        resp = client.post("/tasks", json=task)
        assert resp.status_code == 502
        assert resp.json()["detail"]["code"] == "PROVIDER_UNAVAILABLE"
    finally:
        torque_module.reset_research_provider()


# ===========================================================================
# 5. task_id and run_id Identity Mismatch Detection
# ===========================================================================

def test_conformance_task_id_mismatch_rejection():
    """Verifies that responses with mismatched task_id are rejected as INVALID_PROVIDER_RESULT."""
    task = get_canonical_task_request(task_id="TASK-EXPECTED", run_id="RUN-EXPECTED")

    def mismatched_task_handler(payload, handler):
        res = get_canonical_result_response(task_id="TASK-CORRUPTED-OTHER", run_id="RUN-EXPECTED")
        handler.send_response(200)
        handler.send_header("Content-Type", "application/json")
        handler.end_headers()
        handler.wfile.write(json.dumps(res).encode("utf-8"))

    with local_worker_conformance_context(handler_fn=mismatched_task_handler) as server:
        adapter = torque_module.HttpResearchWorkerAdapter(worker_url=server.url, timeout=5.0)
        torque_module.set_research_provider(adapter)
        try:
            resp = client.post("/tasks", json=task)
            assert resp.status_code == 502
            assert resp.json()["detail"]["code"] == "INVALID_PROVIDER_RESULT"
        finally:
            torque_module.reset_research_provider()


def test_conformance_run_id_mismatch_rejection():
    """Verifies that responses with mismatched run_id are rejected as INVALID_PROVIDER_RESULT."""
    task = get_canonical_task_request(task_id="TASK-EXPECTED", run_id="RUN-EXPECTED")

    def mismatched_run_handler(payload, handler):
        res = get_canonical_result_response(task_id="TASK-EXPECTED", run_id="RUN-CORRUPTED-OTHER")
        handler.send_response(200)
        handler.send_header("Content-Type", "application/json")
        handler.end_headers()
        handler.wfile.write(json.dumps(res).encode("utf-8"))

    with local_worker_conformance_context(handler_fn=mismatched_run_handler) as server:
        adapter = torque_module.HttpResearchWorkerAdapter(worker_url=server.url, timeout=5.0)
        torque_module.set_research_provider(adapter)
        try:
            resp = client.post("/tasks", json=task)
            assert resp.status_code == 502
            assert resp.json()["detail"]["code"] == "INVALID_PROVIDER_RESULT"
        finally:
            torque_module.reset_research_provider()


# ===========================================================================
# 6. Invalid Result Envelope Structures
# ===========================================================================

@pytest.mark.parametrize("corrupt_response,test_name", [
    ({"schema": "wrong.schema.v2", "task_id": "T1", "run_id": "R1", "status": "completed", "producer": {}, "payload": {}, "requires_approval": True}, "wrong_schema"),
    ({"schema": "research.result.v1", "task_id": "T1", "run_id": "R1", "status": "completed"}, "missing_producer_and_payload"),
    ({"schema": "research.result.v1", "task_id": "T1", "run_id": "R1", "producer": {}, "payload": {}}, "missing_status_and_requires_approval"),
    (["not", "a", "dict"], "list_instead_of_dict"),
])
def test_conformance_malformed_result_envelope_structures(corrupt_response, test_name):
    """Verifies rejection of incomplete or schema-violating result dictionaries."""
    task = get_canonical_task_request(task_id="T1", run_id="R1")

    def corrupt_handler(payload, handler):
        handler.send_response(200)
        handler.send_header("Content-Type", "application/json")
        handler.end_headers()
        handler.wfile.write(json.dumps(corrupt_response).encode("utf-8"))

    with local_worker_conformance_context(handler_fn=corrupt_handler) as server:
        adapter = torque_module.HttpResearchWorkerAdapter(worker_url=server.url, timeout=5.0)
        torque_module.set_research_provider(adapter)
        try:
            resp = client.post("/tasks", json=task)
            assert resp.status_code == 502
            assert resp.json()["detail"]["code"] == "INVALID_PROVIDER_RESULT"
        finally:
            torque_module.reset_research_provider()


def test_conformance_non_json_worker_body_rejection():
    """Verifies that non-JSON strings (e.g. HTML 500 error pages) map to INVALID_PROVIDER_RESULT."""
    task = get_canonical_task_request(task_id="T1", run_id="R1")

    def html_handler(payload, handler):
        handler.send_response(200)
        handler.send_header("Content-Type", "text/html")
        handler.end_headers()
        handler.wfile.write(b"<html><body>502 Bad Gateway from Proxy</body></html>")

    with local_worker_conformance_context(handler_fn=html_handler) as server:
        adapter = torque_module.HttpResearchWorkerAdapter(worker_url=server.url, timeout=5.0)
        torque_module.set_research_provider(adapter)
        try:
            resp = client.post("/tasks", json=task)
            assert resp.status_code == 502
            assert resp.json()["detail"]["code"] == "INVALID_PROVIDER_RESULT"
        finally:
            torque_module.reset_research_provider()


# ===========================================================================
# 7. RESEARCH_WORKER_URL Startup, Lifecycle & Fail-Closed Behavior
# ===========================================================================

def test_conformance_startup_defaults_fail_closed(monkeypatch):
    """Verifies that unconfigured runtime fails closed on startup without external worker URL."""
    monkeypatch.delenv("RESEARCH_WORKER_URL", raising=False)
    torque_module.reset_research_provider()

    task = get_canonical_task_request(task_id="T-DEFAULT", run_id="R-DEFAULT")
    resp = client.post("/tasks", json=task)
    assert resp.status_code == 502
    assert resp.json()["detail"]["code"] == "PROVIDER_UNAVAILABLE"


def test_conformance_startup_with_worker_env(monkeypatch):
    """Verifies that configured RESEARCH_WORKER_URL boots into active HttpResearchWorkerAdapter."""
    with local_worker_conformance_context() as server:
        monkeypatch.setenv("RESEARCH_WORKER_URL", server.url)
        torque_module.reset_research_provider()

        active_provider = torque_module.get_research_provider()
        assert isinstance(active_provider, torque_module.HttpResearchWorkerAdapter)
        assert active_provider.worker_url == server.url

        task = get_canonical_task_request(task_id="T-ENV-BOOT", run_id="R-ENV-BOOT")
        resp = client.post("/tasks", json=task)
        assert resp.status_code == 200
        assert resp.json()["task_id"] == "T-ENV-BOOT"
        torque_module.reset_research_provider()
