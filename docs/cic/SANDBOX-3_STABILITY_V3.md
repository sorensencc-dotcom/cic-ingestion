# Stability v3 (ONNX Drift Scoring)

## Drift Scoring

```typescript
interface StabilityResponse {
  avgScore: number,  // 0.0 to 1.0+ (cosine distance)
  level: 'low' | 'medium' | 'high'
}
```

## Classification

| Score Range | Level | Meaning |
|-------------|-------|---------|
| ≤ 0.10 | low | Minimal drift, model stable |
| 0.10 < x ≤ 0.20 | low | Minor variance, acceptable |
| 0.20 < x ≤ 0.30 | medium | Moderate drift, monitor |
| > 0.30 | high | Significant drift, alert |

## API Endpoint

**GET `/api/v3/stability/{modelId}`**

Returns 24-hour rolling average:
```sql
SELECT AVG(drift_score) as avg_drift
FROM cic_model_stability
WHERE model_id = $1 AND timestamp > NOW() - INTERVAL '24 hours'
```

## Dashboard Display

- **Large numeric:** avgScore.toFixed(4)
- **Color-coded level:** green (low), yellow (medium), red (high)
- **Thresholds:** Displayed below score

---

See related:
- [Determinism](SANDBOX-3_DETERMINISM.md)
- [Architecture](SANDBOX-3_ARCHITECTURE.md)
