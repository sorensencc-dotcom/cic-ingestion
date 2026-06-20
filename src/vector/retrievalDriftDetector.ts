/**
 * retrievalDriftDetector.ts
 * Compares current rankings against golden snapshots and raises alerts on drift.
 */

import fs from "node:fs";
import path from "node:path";
import { TorqueQueryPlanner } from "./torqueQueryPlanner.js";
import VectorLayer from "./vectorLayer.js";

export interface DriftAlert {
  goldenId: string;
  expected: string[];
  actual: string[];
  driftScore: number;
}

export class RetrievalDriftDetector {
  #planner: TorqueQueryPlanner;
  #layer: VectorLayer;
  #golden: any[];

  constructor(layer: VectorLayer) {
    this.#layer = layer;

    this.#planner = new TorqueQueryPlanner({
      chunks: { name: "chunks", client: layer.chunks.client },
      context: { name: "context", client: layer.context.client },
      skills: { name: "skills", client: layer.skills.client },
    });

    const goldenPath = path.join(process.cwd(), "src/vector/goldenQueries.json");
    this.#golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
  }

  async check(threshold = 0.3): Promise<DriftAlert[]> {
    const alerts: DriftAlert[] = [];

    for (const gq of this.#golden) {
      const res = await this.#planner.execute({
        vectorPrimary: gq.vectorPrimary,
        limit: gq.expectedTopIds.length,
        collections: gq.collections.map((name: string) => ({
          name,
          client:
            name === "chunks"
              ? this.#layer.chunks.client
              : name === "context"
              ? this.#layer.context.client
              : this.#layer.skills.client,
        })),
        facets: [],
      });

      const actualIds = res.hits.map((h) => h.id);
      const driftScore = this.#computeDriftScore(
        gq.expectedTopIds,
        actualIds
      );

      if (driftScore > threshold) {
        alerts.push({
          goldenId: gq.id,
          expected: gq.expectedTopIds,
          actual: actualIds,
          driftScore,
        });
      }
    }

    return alerts;
  }

  #computeDriftScore(expected: string[], actual: string[]): number {
    // Simple normalized Hamming distance over top-N
    let diff = 0;
    const n = Math.max(expected.length, actual.length);
    for (let i = 0; i < n; i++) {
      if (expected[i] !== actual[i]) diff++;
    }
    return n === 0 ? 0 : diff / n;
  }
}


