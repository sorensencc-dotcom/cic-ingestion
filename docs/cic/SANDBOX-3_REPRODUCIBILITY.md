# Reproducibility in Sandbox-3

## The 4-Part Hash

Every execution returns a reproducibility manifest with four cryptographic hashes:

```typescript
reproducibility: {
  snapshotHash: string,    // Memory + filesystem SHA-256
  fsHash: string,           // Filesystem snapshot SHA-256
  envHash: string,          // Environment variables SHA-256
  vmConfigHash: string      // Firecracker VM config JSON SHA-256
}
```

## Per-Hash Accountability

### 1. vmConfigHash (Firecracker Config)

**What:** The complete Firecracker VM configuration in JSON.

**Pinned:**
- Boot source (kernel + rootfs paths)
- Machine config (2 vCPU, 1GB RAM, no SMT)
- vsock device + socket path
- /tmp as tmpfs drive
- Block device (rootfs)

**Hash Method:**
```typescript
const json = JSON.stringify(config);
const hash = crypto.createHash('sha256').update(json).digest('hex');
```

**Guarantee:** If VM behavior differs, vmConfigHash will differ (unless config is identical).

### 2. envHash (Environment Pinning)

**What:** Deterministic environment variables at boot time.

**Pinned:**
- TZ=UTC (timezone determinism)
- LANG=C.UTF-8 (locale)
- LC_ALL=C.UTF-8 (locale)
- CIC_DETERMINISTIC=true (marker)
- CIC_SEED=<seed> (if provided)

**Hash Method:**
```typescript
const sorted = Object.entries(env)
  .sort(([k1], [k2]) => k1.localeCompare(k2))
  .map(([k, v]) => `${k}=${v}`);
const hash = crypto.createHash('sha256').update(sorted.join('\n')).digest('hex');
```

**Guarantee:** Same environment variables → same envHash.

### 3. fsHash (Filesystem State)

**What:** Snapshot of root filesystem after execution.

**Hashing:**
- Streaming SHA-256 of filesystem tar/snapshot
- Prevents OOM on large disks
- Captures all files modified during execution

**Guarantee:** Same filesystem state → same fsHash.

### 4. snapshotHash (Memory State)

**What:** Memory snapshot captured after execution (optional).

**Hashing:**
- Streaming SHA-256 of memory dump
- Only if `createSnapshot: true`

**Guarantee:** Same memory state → same snapshotHash.

## Reproducibility Workflow

### Step 1: Initial Execution (with seed)

```bash
result = await harnessV3.run(code, {
  runId: 'run-123',
  modelId: 'claude-v3',
  seed: 42,
  collectTrace: true
})

// Returns reproducibility metadata
console.log(result.manifest.reproducibility)
// {
//   snapshotHash: 'abc123...',
//   fsHash: 'def456...',
//   envHash: 'ghi789...',
//   vmConfigHash: 'jkl012...'
// }
```

### Step 2: Store Hashes

Save in PostgreSQL:

```sql
INSERT INTO cic_audit_log (
  run_id, reproducibility_json, ...
) VALUES (
  'run-123',
  '{"snapshotHash":"abc123...","fsHash":"def456..."...}',
  ...
)
```

### Step 3: Reproduction Test

Re-execute with same seed:

```bash
result2 = await harnessV3.run(code, {
  runId: 'run-123-repro',
  modelId: 'claude-v3',
  seed: 42,  // Same seed
  collectTrace: true
})

// Verify all 4 hashes match
assert(result.manifest.reproducibility.vmConfigHash === result2.manifest.reproducibility.vmConfigHash)
assert(result.manifest.reproducibility.envHash === result2.manifest.reproducibility.envHash)
assert(result.manifest.reproducibility.fsHash === result2.manifest.reproducibility.fsHash)
assert(result.manifest.reproducibility.snapshotHash === result2.manifest.reproducibility.snapshotHash)
```

### Step 4: Hash Match → Reproducibility Verified

If all 4 hashes match:
- ✅ VM config identical
- ✅ Environment identical
- ✅ Filesystem state identical
- ✅ Memory state identical

**Conclusion:** Execution is deterministic (given seed + code).

## API Endpoint

**GET `/api/v3/reproducibility/{runId}`**

Returns:
```typescript
{
  vmConfigHash: string,
  envHash: string,
  fsHash: string,
  snapshotHash: string
}
```

---

See related:
- [Determinism](SANDBOX-3_DETERMINISM.md)
- [Architecture](SANDBOX-3_ARCHITECTURE.md)
