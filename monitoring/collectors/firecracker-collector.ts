import { firecrackerBootHistogram } from "../prometheus/sandbox-3-metrics";

export async function collectFirecrackerMetrics() {
  const bootTime = await measureBootTime(); // TODO: implement
  firecrackerBootHistogram.observe(bootTime);
}

async function measureBootTime() {
  // Placeholder: integrate with Firecracker host API
  return Math.random() * 300;
}
