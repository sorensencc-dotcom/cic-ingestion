# ExecutionHarnessV3

## Interface

```typescript
class ExecutionHarnessV3 {
  constructor(sloBudgetMs: number)
  
  async run(code: string, options: {
    runId: string,
    modelId: string,
    seed?: number,
    collectTrace?: boolean
  }): Promise<{
    result: S3ExecutionResult,
    manifest: RunManifestV3
  }>
}
```

## Execution Flow

1. **SLO Budget Setup:** Derive hard timeout = sloBudgetMs + 5000ms padding
2. **KillSwitch Enforcement:** Wrap S3Executor with hard timeout via Promise.race()
3. **SLO Verification:** LatencySloManager.enforce(latencyMs) → SloStatus
4. **Manifest Construction:** Bundle execution metadata + reproducibility + telemetry
5. **Return:** { result, manifest }

## RunManifestV3 Structure

```typescript
interface RunManifestV3 {
  runId: string
  sandboxTier: 'S3'  // Firecracker
  modelId: string
  exitCode: number
  latencyMs: number
  sloViolated: boolean  // Soft enforcement (warns but doesn't throw)
  reproducibility: {
    snapshotHash: string,
    fsHash: string,
    envHash: string,
    vmConfigHash: string
  }
  telemetry: {
    networkEvents: number,    // eBPF captured packets
    syscallEvents: number,    // strace captured calls
    fileAccessEvents: number  // open/openat derivation
  }
}
```

## SLO Enforcement

### Hard Timeout (Mandatory)
- KillSwitch enforces absolute deadline
- Kills VM if execution exceeds hardTimeoutMs
- Throws HardTimeoutError on breach

### Soft SLO (Informational)
- LatencySloManager compares latencyMs vs. sloBudgetMs
- Logs warning if exceeded
- Returns sloViolated flag but doesn't throw
- Allows graceful degradation (execute, then handle SLO breach)

## Error Handling

| Error | Handling |
|-------|----------|
| KillSwitch timeout | Throws HardTimeoutError |
| S3Executor failure | Propagates to caller |
| SLO violation | Logs warning, sets manifest.sloViolated=true |
| Trace ingestion failure | Non-fatal, logged |

---

See related:
- [Latency & SLO](SANDBOX-3_LATENCY.md)
- [Runtime](SANDBOX-3_RUNTIME.md)
