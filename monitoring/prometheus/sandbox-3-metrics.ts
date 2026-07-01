import client from "prom-client";

export const reproducibilityGauge = new client.Gauge({
  name: "sandbox3_reproducibility_score",
  help: "Reproducibility score (0–1)"
});

export const stabilityGauge = new client.Gauge({
  name: "sandbox3_stability_score",
  help: "Stability v3 score"
});

export const firecrackerBootHistogram = new client.Histogram({
  name: "sandbox3_firecracker_boot_ms",
  help: "Firecracker VM boot time",
  buckets: [50, 100, 200, 300, 500, 1000]
});
