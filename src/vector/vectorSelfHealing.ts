/**
 * vectorSelfHealing.ts
 * Simple self‑healing loop and drift detection watchdog for VectorLayer.
 */

import VectorLayer from "./vectorLayer.js";
import { RetrievalDriftDetector } from "./retrievalDriftDetector.js";

export class VectorSelfHealer {
  #layer: VectorLayer;
  #intervalMs: number;
  #timer: NodeJS.Timeout | null = null;
  #driftDetector: RetrievalDriftDetector;

  constructor(layer: VectorLayer, intervalMs = 30000) {
    this.#layer = layer;
    this.#intervalMs = intervalMs;
    this.#driftDetector = new RetrievalDriftDetector(layer);
  }

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      this.check().catch((err) =>
        console.error("VectorSelfHealer: check error", err)
      );
    }, this.#intervalMs);
  }

  stop() {
    if (!this.#timer) return;
    clearInterval(this.#timer);
    this.#timer = null;
  }

  async check() {
    const health = await this.#layer.health();

    const unhealthy = Object.entries(health)
      .filter(([, ok]) => !ok)
      .map(([name]) => name);

    if (unhealthy.length > 0) {
      console.error("VectorSelfHealer: unhealthy collections", unhealthy);
      // Deterministic remediation: re‑ensure collections.
      await this.#layer.ensureCollections();
    }

    // Run retrieval drift check if collections are healthy
    if (unhealthy.length === 0) {
      try {
        const driftAlerts = await this.#driftDetector.check(0.3);
        if (driftAlerts.length > 0) {
          console.warn("VectorSelfHealer: retrieval drift detected", driftAlerts);
        }
      } catch (err) {
        console.error("VectorSelfHealer: drift check error", err);
      }
    }
  }
}


