import client from "prom-client";

const onnxLatency = new client.Histogram({
  name: "sandbox3_onnx_inference_ms",
  help: "ONNX inference latency",
  buckets: [1, 5, 10, 20, 50, 100]
});

export async function collectOnnxMetrics() {
  const latency = await measureInference(); // TODO: integrate ONNX runtime
  onnxLatency.observe(latency);
}

async function measureInference() {
  return Math.random() * 20;
}
