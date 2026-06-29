# Network Tracing (eBPF)

## NetworkTraceEvent

```typescript
interface NetworkTraceEvent {
  timestamp: string,      // ISO 8601
  dest_ip: string,
  dest_port: number,
  protocol: string,       // 'tcp', 'udp', etc.
  bytes_sent: number,
  bytes_received: number
}
```

## Capture Mechanism

### eBPF Attachment
```bash
tc qdisc add dev tap-<vmId> clsact
tc filter add dev tap-<vmId> ingress bpf obj network_trace.o sec ingress
tc filter add dev tap-<vmId> egress bpf obj network_trace.o sec egress
```

### eBPF Map Dump
```bash
bpftool map dump name cic_net_trace_<vmId> --json
```

Parses JSON output → NetworkTraceEvent[]

## Storage

### PostgreSQL Table
```sql
CREATE TABLE cic_network_trace (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES cic_audit_log(run_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  dest_ip TEXT NOT NULL,
  dest_port INT NOT NULL,
  protocol TEXT NOT NULL,
  bytes_sent INT NOT NULL,
  bytes_received INT NOT NULL
)

CREATE INDEX idx_network_run_id ON cic_network_trace(run_id)
CREATE INDEX idx_network_dest_ip ON cic_network_trace(dest_ip)
CREATE INDEX idx_network_ts ON cic_network_trace(timestamp)
```

## API Endpoint

**GET `/api/v3/traces/{runId}`**

Returns:
```typescript
{
  networkTrace: NetworkTraceEvent[],
  fileAccess: FileAccessEvent[]
}
```

## Dashboard Display

- **Network Events section:** Scrollable list
- **Format:** `HH:MM:SS | protocol dest_ip:dest_port (Tx: XXB, Rx: XXB)`
- **Count:** Displayed in panel header

---

See related:
- [Tracing](SANDBOX-3_TRACING.md)
- [Syscall Trace](SANDBOX-3_SYSCALL_TRACE.md)
