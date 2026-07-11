# Ingestion Service Logging

CIC ingestion autonomy server runtime logs.

## Retention

30 days. Compress after 7 days.

## Examples

```
agents-api-2026-06-25.log    # API server activity
```

## Monitoring

Search for errors:
```bash
grep "ERROR\|FATAL\|exception" cic-ingestion/logs/runtime/*.log
```

See [Logging Policy](../../docs/operations/logging-policy.md)
