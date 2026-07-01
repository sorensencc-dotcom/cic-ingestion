export function validateLatencyEnvelope(samples: number[]) {
  samples.sort((a, b) => a - b);

  const p50 = samples[Math.floor(samples.length * 0.50)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  const p99 = samples[Math.floor(samples.length * 0.99)];

  return {
    p50,
    p95,
    p99,
    passed: p50 < 20 && p95 < 40 && p99 < 60,
  };
}
