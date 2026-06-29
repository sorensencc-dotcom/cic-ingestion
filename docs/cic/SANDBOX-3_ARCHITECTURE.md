# Sandbox-3 Architecture

## System Design

```
Execution Request (code, seed, options)
  ↓
ExecutionHarnessV3
  ├→ LatencySloManager (enforce budget)
  ├→ KillSwitch (hard timeout via Promise.race())
  ├→ S3Executor (Firecracker orchestration)
  │   ├→ Jailer (UID/GID/chroot isolation)
  │   ├→ FirecrackerRuntime (VM lifecycle)
  │   │   ├→ buildConfig() (VM JSON, validated paths)
  │   │   └→ spawn() (actual Firecracker binary)
  │   ├→ TraceCollector (eBPF + strace)
  │   ├→ Snapshot (SHA-256 hashing)
  │   └→ ingestTrace() (PostgreSQL storage)
  └→ Return RunManifestV3 (metadata + reproducibility)
```

## Data Flow

### Execution Path

1. **Input:** `code`, `seed` (optional), `timeoutMs`, `collectTrace` (optional)
2. **Determinism Setup:** Inject seed → build config → prepare environment
3. **VM Boot:** Firecracker binary spawned with isolated socket
4. **Tracing:** Network + syscall capture (parallel)
5. **Execution:** Code sent via vsock, hard timeout enforced
6. **Snapshot:** Memory + filesystem hashed
7. **Ingestion:** Traces to PostgreSQL (JSONB + dedicated tables)
8. **Manifest:** SLO status + reproducibility hashes returned

### Observable Path

1. **Dashboard Request:** User views `/sandbox3` page
2. **API Calls:** 4 parallel fetches
   - `/api/v3/latency/{runId}` → LatencyResponse
   - `/api/v3/reproducibility/{runId}` → ReproducibilityResponse
   - `/api/v3/stability/{modelId}` → StabilityResponse
   - `/api/v3/traces/{runId}` → TracesResponse
3. **Render:** UI displays hashes, network events, syscall events, latency, SLO status

## Reproducibility Layers

| Layer | Pinning Mechanism | Hash |
|-------|-------------------|------|
| **Kernel** | Validated path → SHA-256 | fsHash |
| **Rootfs** | Validated path → SHA-256 | fsHash |
| **VM Config** | Firecracker JSON → SHA-256 | vmConfigHash |
| **Environment** | TZ=UTC, LANG=C.UTF-8, sorted keys → SHA-256 | envHash |
| **/tmp** | tmpfs drive mounted in config | (in vmConfigHash) |
| **Embeddings** | ONNX ORT_DETERMINISTIC=1, CPU-only, single thread | (via seed) |
| **Memory/FS** | Streaming SHA-256 post-execution | snapshotHash |
| **Seed** | Injected at boot, propagated through pipeline | (tracks all) |

## Determinism Guarantees

**Given identical seed + code + timeoutMs:**
- Same VM config JSON → same vmConfigHash
- Same environment variables → same envHash
- Same memory/filesystem state → same snapshotHash
- Same ONNX inference → same drift scores
- Same network capture → same trace events
- Same execution result → reproducible latencyMs

**Reproduction:** Re-execute with stored seed → verify 4-part hash matches.

---

See related:
- [Runtime](SANDBOX-3_RUNTIME.md)
- [Firecracker](SANDBOX-3_FIRECRACKER.md)
- [Reproducibility](SANDBOX-3_REPRODUCIBILITY.md)
