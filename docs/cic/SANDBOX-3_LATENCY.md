# Latency & SLO Enforcement

## SloStatus Interface

```typescript
interface SloStatus {
  violated: boolean
  exceededByMs: number
}
```

## LatencySloManager

```typescript
class LatencySloManager {
  constructor(budgetMs: number)
  
  enforce(latencyMs: number): SloStatus {
    if (latencyMs > budgetMs) {
      return { violated: true, exceededByMs: latencyMs - budgetMs }
    }
    return { violated: false, exceededByMs: 0 }
  }
}
```

**Behavior:**
- Compares actual latencyMs against budget
- Returns status (violation flag + excess ms)
- Soft enforcement (doesn't throw)

## KillSwitch (Hard Timeout)

```typescript
class KillSwitch {
  static enforce<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    if (timeoutMs <= 0) throw new Error('[KillSwitch] timeoutMs must be positive')
    
    return Promise.race([
      promise.finally(() => clearTimeout(timeoutHandle)),
      timeoutPromise
    ])
  }
}
```

**Behavior:**
- Promise.race() ensures absolute deadline
- Timeout rejects with HardTimeoutError
- Original promise cleanup automatic (clearTimeout)
- Generic <T> for type-safe return values

## Enforcement Strategy

### Hard Timeout (Mandatory)
- Derived as: sloBudgetMs + 5000ms padding
- KillSwitch enforces via Promise.race()
- VM killed if execution exceeds deadline
- Throws HardTimeoutError (catastrophic)

### Soft SLO (Informational)
- LatencySloManager compares actual vs. budget
- Logs warning if exceeded
- Returns sloViolated flag
- Doesn't throw (graceful)

## API Endpoint

**GET `/api/v3/latency/{runId}`**

Returns:
```typescript
{
  latencyMs: number,
  sloViolated: boolean
}
```

## Dashboard Display

- **Latency:** Large numeric display (ms)
- **SLO Status:** Color-coded (green=PASS, red=VIOLATED)
- **Real-time:** Updates on page load

---

See related:
- [Harness v3](SANDBOX-3_HARNESS_V3.md)
- [Architecture](SANDBOX-3_ARCHITECTURE.md)
