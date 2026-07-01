import express from "express";
import client from "prom-client";

const app = express();
const registry = new client.Registry();

const latencyHistogram = new client.Histogram({
  name: "cic_api_latency_ms",
  help: "Latency histogram for CIC API",
  buckets: [10, 25, 50, 100, 250, 500, 1000]
});

const driftGauge = new client.Gauge({
  name: "cic_drift_score",
  help: "Drift v3 score"
});

registry.registerMetric(latencyHistogram);
registry.registerMetric(driftGauge);

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});

app.listen(8081, () => {
  console.log("CIC metrics exporter running on :8081");
});
