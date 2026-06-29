# Sandbox-3 Runtime

## Components

### FirecrackerRuntime (firecracker-runtime.ts)

Manages VM lifecycle: boot, shutdown, state tracking.

```typescript
constructor(vmId, kernel, rootfs, bootEnv?)
boot(seed?) → Promise<vmConfigHash>
teardown() → Promise<void>
getState() → 'init' | 'booting' | 'running' | 'teardown'
```

**State Machine:**
```
init → booting → running → teardown
```

**Socket Cleanup:**
- `-api.socket`: Firecracker API endpoint
- `.socket`: vsock listener (communication channel)

Both cleaned on teardown.

### FirecrackerJailer (firecracker-jailer.ts)

Process isolation via chroot + UID/GID enforcement.

```typescript
exec(vmId, uid, gid, kernelPath, rootfsPath) → Promise<jailerPid>
```

**Regex-based PID Parsing:**
```typescript
const match = stdout.match(/\d+/);
const pid = parseInt(match![0], 10);
```

Robust against malformed output.

### FirecrackerVsock (firecracker-vsock.ts)

Unix domain socket communication with hard timeout.

```typescript
sendCommand(code, timeoutMs = 5000) → Promise<{ stdout, stderr, exitCode }>
```

**Promise.race() Kill-Switch:**
- Command promise vs. timeout promise
- Timeout rejects with `KillSwitch error`
- Socket cleanup automatic on resolution

### SnapshotManager (firecracker-snapshot.ts)

Streaming SHA-256 hashing (prevents OOM on large files).

```typescript
hashFileStream(filePath) → Promise<hash>
```

**Streaming Approach:**
- fs.createReadStream() for large files
- crypto.createHash('sha256') + pipe()
- No readFileSync() (would load entire file in memory)

### S3ExecutorV3 (s3-exec-firecracker-v3.ts)

End-to-end orchestration: jailer → boot → execute → snapshot → teardown.

```typescript
executeS3(code, { seed?, timeoutMs?, createSnapshot?, collectTrace? })
  → Promise<S3ExecutionResult>
```

**Returns:**
```typescript
{
  stdout: string,
  stderr: string,
  exitCode: number,
  latencyMs: number,
  reproducibility: {
    snapshotHash: string,
    fsHash: string,
    envHash: string,
    vmConfigHash: string
  },
  traceData?: CollectedTrace
}
```

## Determinism Flow

```
seed (optional)
  ↓
prepareDeterministicEnv(seed) → { env, envHash }
  (TZ=UTC, LANG=C.UTF-8, sorted keys, SHA-256)
  ↓
Jailer(vmId, uid=1000, gid=1000)
  (UID/GID enforcement)
  ↓
FirecrackerRuntime.boot(seed)
  ├→ buildConfig(vmId, kernel, rootfs) → { configPath, vmConfigHash }
  ├→ spawn('firecracker', ['--config-file', configPath])
  └→ environment injected at boot
  ↓
FirecrackerVsock.sendCommand(code, timeout)
  (5s default, configurable)
  ↓
SnapshotManager.createSnapshot() → { snapshotHash, fsHash }
  ↓
ingestTrace() → PostgreSQL
  ↓
Return { latencyMs, reproducibility, traceData }
```

## Error Handling

| Error | Handling |
|-------|----------|
| Missing kernel | Throws before boot |
| Missing rootfs | Throws before boot |
| Socket creation failed | Throws, cleanup automatic |
| Timeout exceeded | KillSwitch rejects, cleanup automatic |
| Snapshot hash failed | Throws with logged path |
| Trace ingestion failed | Logs error, continues (non-fatal) |

---

See related:
- [Firecracker](SANDBOX-3_FIRECRACKER.md)
- [VM Snapshotting](SANDBOX-3_VM_SNAPSHOTTING.md)
- [Harness v3](SANDBOX-3_HARNESS_V3.md)
