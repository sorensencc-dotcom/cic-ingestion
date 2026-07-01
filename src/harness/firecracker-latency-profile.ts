import { bootVM } from "../sandbox/firecracker";

export async function profileFirecracker() {
  const samples: number[] = [];

  for (let i = 0; i < 5; i++) {
    const ms = await bootVM();
    samples.push(ms);
  }

  const mean =
    samples.reduce((a, b) => a + b, 0) / samples.length;

  const variance =
    samples.reduce((a, b) => a + (b - mean) ** 2, 0) /
    samples.length;

  const cv = Math.sqrt(variance) / mean;

  return { samples, mean, variance, cv };
}
