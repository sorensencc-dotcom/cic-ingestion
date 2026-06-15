/**
 * index.ts
 * CIC Vector Subsystem Wiring Hub
 * v1.0.0 — 2026-06-14
 *
 * Wires:
 *  - VectorLayer
 *  - API routes
 *  - Self-healing
 */
import VectorLayer from "./vectorLayer.js";
import { VectorSelfHealer } from "./vectorSelfHealing.js";
export declare function wireVectorLayer(app: any): Promise<{
    layer: VectorLayer;
    healer: VectorSelfHealer;
}>;
//# sourceMappingURL=index.d.ts.map