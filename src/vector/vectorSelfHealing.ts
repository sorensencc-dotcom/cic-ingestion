/**
 * vectorSelfHealing.ts
 * Simple self‑healing loop for VectorLayer.
 */

import VectorLayer from "./vectorLayer.js";

export class VectorSelfHealer {
  #layer: VectorLayer;
  #intervalMs: number;
  #timer: NodeJS.Timeout | null = null;

  constructor(layer: VectorLayer, intervalMs = 30000) {
    this.#layer = layer;
    this.#intervalMs = intervalMs;
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

    if (unhealthy.length === 0) return;

    console.error("VectorSelfHealer: unhealthy collections", unhealthy);

    // Deterministic remediation: re‑ensure collections.
    await this.#layer.ensureCollections();
  }
}
