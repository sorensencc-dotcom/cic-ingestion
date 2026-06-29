# VM Snapshotting

## Overview

After execution, Sandbox-3 captures memory and filesystem state via streaming SHA-256 hashing.

## Implementation

### SnapshotManager

```typescript
class SnapshotManager {
  async createSnapshot(): Promise<{ snapshotHash, fsHash, envHash }>
}
```

## Streaming Hash

Why streaming instead of readFileSync()?

| Approach | Memory | Speed | Correctness |
|----------|--------|-------|-------------|
| readFileSync | ❌ OOM risk | Fast | ✅ Correct |
| Streaming | ✅ Constant | Slower | ✅ Correct |

**Streaming approach (recommended):**
```typescript
async function hashFileStream(filePath: string): Promise<string> {
  const stream = fs.createReadStream(filePath)
  const hash = crypto.createHash('sha256')
  
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
```

## Components

### snapshotHash
- SHA-256 of VM memory dump (post-execution)
- Only captured if `createSnapshot: true`
- Streaming approach (no OOM)

### fsHash
- SHA-256 of root filesystem state
- Always captured (determinism verification)
- Includes all files modified during execution

### envHash
- SHA-256 of pinned environment variables
- Computed during boot (not from snapshot)

## Cleanup

- Temporary snapshot files removed after hash computed
- No persistent storage (unless archived separately)

## API

Snapshots exposed via:

**GET `/api/v3/reproducibility/{runId}`**
- Returns: vmConfigHash, envHash, fsHash, snapshotHash (all hashes, no blob data)

---

See related:
- [Reproducibility](SANDBOX-3_REPRODUCIBILITY.md)
- [Runtime](SANDBOX-3_RUNTIME.md)
