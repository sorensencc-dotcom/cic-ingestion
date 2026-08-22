# Research Worker Protocol & Adapter Boundary

This document defines the configuration, timeout semantics, failure codes, and startup lifecycle for the TorqueQuery v2 research task execution boundary (`POST /tasks`).

---

## 1. Architecture & Execution Model

TorqueQuery v2 provides a typed adapter boundary (`ResearchProviderAdapter`) that routes `research.task.v1` requests to an external research worker and validates the resulting `research.result.v1` response envelope.

```
                  POST /tasks
                       │
                       ▼
          ┌──────────────────────────┐
          │   TorqueQueryV2Server    │
          │   (Schema Validation)    │
          └────────────┬─────────────┘
                       │
                       ▼
          ┌──────────────────────────┐
          │ ResearchProviderAdapter  │
          │   - HttpResearchWorker   │
          │   - DefaultFailing       │
          └────────────┬─────────────┘
                       │
                       ▼ (HTTP POST)
          ┌──────────────────────────┐
          │ External Research Worker │
          │ (TRM / LLM / Multi-Agent)│
          └──────────────────────────┘
```

> [!NOTE]
> **Production Boundary**: TorqueQuery delegates all research execution to external workers. The internal `/search` endpoint remains a deterministic memory/drift search simulation and is never used as a synthetic research engine.

---

## 2. Configuration & Startup Behavior

### Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `RESEARCH_WORKER_URL` | string (URL) | `None` | Endpoint URL of the external research worker (e.g., `http://127.0.0.1:8001/tasks`). |

### Startup Lifecycle

1. **Default Fail-Closed Initialization**:
   - On server startup, `configure_research_provider_from_env()` inspects `RESEARCH_WORKER_URL`.
   - If `RESEARCH_WORKER_URL` is unset or empty, the runtime mounts `DefaultFailingProviderAdapter` and immediately fails closed with HTTP 502 (`PROVIDER_UNAVAILABLE`) for any `POST /tasks` call.
   - If `RESEARCH_WORKER_URL` is populated, the runtime instantiates `HttpResearchWorkerAdapter(worker_url=...)`.

2. **Programmatic Injection**:
   - Call `set_research_provider(adapter)` to inject a custom `ResearchProviderAdapter` instance or callable handler.
   - Call `reset_research_provider()` to re-synchronize the active provider with the current environment configuration.

---

## 3. Timeout Configuration

- Default request timeout: **30.0 seconds**.
- Configurable via `HttpResearchWorkerAdapter(worker_url=..., timeout=...)`.
- If the external worker does not respond within the timeout window, the adapter catches `TimeoutError` / `socket.timeout` and raises `ProviderUnavailableError`.

---

## 4. Failure Codes & Error Mapping

All research provider errors are mapped to HTTP 502 with structured error JSON:

```json
{
  "detail": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "reason for failure"
  }
}
```

### Structured Error Summary

| Error Code | HTTP Status | Cause |
|---|---|---|
| `PROVIDER_UNAVAILABLE` | `502` | `RESEARCH_WORKER_URL` unconfigured. |
| `PROVIDER_UNAVAILABLE` | `502` | Worker endpoint unreachable, connection refused, connection reset, or DNS resolution failure. |
| `PROVIDER_UNAVAILABLE` | `502` | Worker request timed out. |
| `PROVIDER_UNAVAILABLE` | `502` | Worker returned HTTP 5xx server error. |
| `INVALID_PROVIDER_RESULT` | `502` | Worker response is not valid JSON. |
| `INVALID_PROVIDER_RESULT` | `502` | Worker response `schema` is not `research.result.v1`. |
| `INVALID_PROVIDER_RESULT` | `502` | Worker response `task_id` or `run_id` does not match the request. |
| `INVALID_PROVIDER_RESULT` | `502` | Worker response is missing required envelope fields (`producer`, `payload`, `status`, `requires_approval`). |
| `INVALID_PROVIDER_RESULT` | `502` | Worker rejected task with HTTP 400 or HTTP 422. |

---

## 5. Contract Linkage

The adapter guarantees that the following fields from the incoming `research.task.v1` payload remain linked and preserved:
- `task_id` and `run_id`: Verified for strict identity match in the response.
- `idempotency_key`: Passed intact to the worker payload.
- `approval_required`: Propagated to `requires_approval` in the response envelope.
- `subject` and `constraints`: Forwarded in the task body without mutation.
