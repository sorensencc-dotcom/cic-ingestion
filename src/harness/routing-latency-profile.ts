import { selectRegime } from "../routing/regimeSelector";

export async function profileRouting() {
  const samples: number[] = [];

  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    selectRegime({ task: "summarize", size: 128 });
    const end = performance.now();
    samples.push(end - start);
  }

  const mean =
    samples.reduce((a, b) => a + b, 0) / samples.length;

  const variance =
    samples.reduce((a, b) => a + (b - mean) ** 2, 0) /
    samples.length;

  const cv = Math.sqrt(variance) / mean;

  return { samples, mean, variance, cv };
}
