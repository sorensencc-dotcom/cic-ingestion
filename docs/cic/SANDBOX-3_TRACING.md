# Execution Tracing

## Overview

Sandbox-3 captures two trace streams during execution:

1. **Network Trace:** eBPF-based packet capture
2. **Syscall Trace:** strace-based system call capture

Both streams collected in parallel, persisted to PostgreSQL.

## TraceCollector

```typescript
class TraceCollector {
  async startTracing(): Promise<void>
  async collectTrace(): Promise<CollectedTrace>
}

interface CollectedTrace {
  networkTrace: NetworkTraceEvent[],
  syscallTrace: SyscallTraceEvent[],
  fileAccess: FileAccessEvent[]
}
```

## Components

### NetworkTracer (eBPF)
- Attaches to `tap-<vmId>` interface via `tc qdisc` + `tc filter`
- Captures ingress/egress packets
- Parses via `bpftool map dump` JSON export
- Returns: timestamp, dest_ip, dest_port, protocol, bytes_sent, bytes_received

### SyscallTracer (strace)
- Attaches to Firecracker PID via `strace -p <pid>`
- Uses `-ttt` (epoch timestamps) + `-s 256` (expand args)
- Parses columnar output with regex
- Returns: timestamp, syscall, args_json, result, error_code

### File Access Derivation
- Filters SyscallTraceEvent for `open` or `openat` syscalls
- Extracts filename from args[1]
- Compiles into FileAccessEvent[]

## Ingestion to PostgreSQL

```typescript
await ingestTrace(runId, collectedTrace)
  ├→ UPDATE cic_audit_log SET network_trace_json, syscall_trace_json, file_access_json
  ├→ INSERT INTO cic_network_trace (run_id, timestamp, dest_ip, ...)
  └→ INSERT INTO cic_syscall_trace (run_id, timestamp, syscall, ...)
```

## Tables

### cic_network_trace
- PK: id (BIGSERIAL)
- FK: run_id → cic_audit_log(run_id) ON DELETE CASCADE
- Indexes: run_id, dest_ip, timestamp

### cic_syscall_trace
- PK: id (BIGSERIAL)
- FK: run_id → cic_audit_log(run_id) ON DELETE CASCADE
- Indexes: run_id, syscall, timestamp

## Lifecycle

1. TraceCollector.startTracing() → both tracers start (parallel)
2. Code executes in VM
3. TraceCollector.collectTrace() → both tracers stop + parse (parallel)
4. ingestTrace() → PostgreSQL storage
5. RunManifestV3 includes telemetry counts (networkEvents, syscallEvents, fileAccessEvents)

---

See related:
- [Network Trace](SANDBOX-3_NETWORK_TRACE.md)
- [Syscall Trace](SANDBOX-3_SYSCALL_TRACE.md)
