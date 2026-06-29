# Syscall Tracing (strace)

## SyscallTraceEvent

```typescript
interface SyscallTraceEvent {
  timestamp: string,       // ISO 8601 (converted from epoch)
  syscall: string,         // e.g., 'open', 'openat', 'read', 'write'
  args_json: string,       // JSON array of arguments
  result: number,          // Return value (negative = error)
  error_code: string | null  // e.g., 'EACCES', 'ENOENT'
}
```

## Capture Mechanism

### strace Attachment
```bash
strace -p <firecracker_pid> -ttt -s 256 -o /tmp/strace_<vmId>.out
```

**Flags:**
- `-p <pid>`: Attach to running process
- `-ttt`: Epoch timestamps (microsecond precision)
- `-s 256`: Expand string arguments (default 32)
- `-o`: Output file path

### Columnar Output Parsing
```
1625123456.123456 openat(AT_FDCWD, "/etc/passwd", O_RDONLY) = -1 EACCES
                  ^                  ^                          ^ ^
              timestamp          syscall                 result error_code
```

**Regex:**
```typescript
const match = line.match(/^(\d+\.\d+)\s+([a-zA-Z0-9_]+)\((.*)\)\s+=\s+(-?\d+)(?:\s+([A-Z0-9_]+))?/)
// Groups: [1]=timestamp, [2]=syscall, [3]=args, [4]=result, [5]=error_code
```

## File Access Derivation

```typescript
const fileAccess = syscallTrace
  .filter(s => s.syscall === 'open' || s.syscall === 'openat')
  .map(s => {
    const args = JSON.parse(s.args_json)
    return { file: args[1], result: s.result, error_code: s.error_code }
  })
```

Extracts: syscall name, filename (args[1]), result code, error_code

## Storage

### PostgreSQL Table
```sql
CREATE TABLE cic_syscall_trace (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES cic_audit_log(run_id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  syscall TEXT NOT NULL,
  result INT NOT NULL,
  error_code TEXT,
  args_json JSONB
)

CREATE INDEX idx_syscall_run_id ON cic_syscall_trace(run_id)
CREATE INDEX idx_syscall_name ON cic_syscall_trace(syscall)
CREATE INDEX idx_syscall_ts ON cic_syscall_trace(timestamp)
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

- **File Access Events section:** Scrollable list
- **Format:** `/path/to/file | Result: 0 (error_code if present)`
- **Count:** Displayed in panel header

---

See related:
- [Tracing](SANDBOX-3_TRACING.md)
- [Network Trace](SANDBOX-3_NETWORK_TRACE.md)
