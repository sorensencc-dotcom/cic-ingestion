# Determinism Guarantees

## Reproducibility Contract

Given:
- Same `code` input
- Same `seed` value
- Same `timeoutMs` value
- Same host environment (kernel, system libraries, Docker image)

Then:
- Same execution output (stdout, stderr, exitCode)
- Same latencyMs ± variance (VM scheduling)
- Same reproducibility hashes (vmConfigHash, envHash, fsHash, snapshotHash)
- Same trace events (network, syscall, file access)

## Determinism Layers

| Layer | Mechanism | Verification |
|-------|-----------|--------------|
| **Firecracker Config** | JSON serialization + SHA-256 | vmConfigHash |
| **Environment** | TZ=UTC, LANG=C.UTF-8, sorted keys | envHash |
| **Kernel/Rootfs** | Validated paths + SHA-256 | fsHash |
| **ONNX Inference** | ORT_DETERMINISTIC=1, CPU-only, single thread | (via seed) |
| **Memory/FS Snapshot** | Streaming SHA-256 post-execution | snapshotHash |

## Environment Pinning

```typescript
function prepareDeterministicEnv(seed?: number) {
  const env = {
    TZ: 'UTC',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    CIC_DETERMINISTIC: 'true',
    ...(seed !== undefined && { CIC_SEED: seed.toString() })
  }
  
  const sorted = Object.entries(env)
    .sort(([k1], [k2]) => k1.localeCompare(k2))
  
  const envHash = crypto.createHash('sha256')
    .update(sorted.map(([k, v]) => `${k}=${v}`).join('\n'))
    .digest('hex')
  
  return { env, envHash }
}
```

## ONNX Determinism

```typescript
const session = new ort.InferenceSession(modelPath, {
  executionProviders: ['cpu'],
  env: {
    ORT_DETERMINISTIC: 1,
    ORT_NUM_THREADS: 1
  }
})
```

**Why:**
- `ORT_DETERMINISTIC=1` enforces no nondeterminism (no random ops)
- `ORT_NUM_THREADS=1` eliminates race conditions from parallelism
- CPU provider (not GPU) guarantees determinism across runs

## Verification Workflow

```bash
# First execution
result1 = executeS3(code, { seed: 42 })
hashes1 = result1.reproducibility

# Re-execution
result2 = executeS3(code, { seed: 42 })
hashes2 = result2.reproducibility

# Verify all 4 hashes match
assert(hashes1.vmConfigHash === hashes2.vmConfigHash)
assert(hashes1.envHash === hashes2.envHash)
assert(hashes1.fsHash === hashes2.fsHash)
assert(hashes1.snapshotHash === hashes2.snapshotHash)
// ✅ Reproducible
```

## Known Non-Determinism Sources

### Latency Variance
- VM scheduling varies
- Network jitter
- Disk I/O timing

**Mitigation:** Hard timeout + SLO enforcement (accept variance)

### Random Number Generation
- ONNX random ops (eliminated via ORT_DETERMINISTIC=1)
- Kernel entropy sources

**Mitigation:** Seed injection + deterministic preprocessing

### External Dependencies
- System time (pinned to TZ=UTC)
- Locale settings (pinned to LANG=C.UTF-8)
- Environment variables (explicitly pinned)

---

See related:
- [Reproducibility](SANDBOX-3_REPRODUCIBILITY.md)
- [Architecture](SANDBOX-3_ARCHITECTURE.md)
