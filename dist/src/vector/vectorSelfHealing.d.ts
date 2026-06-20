/**
 * vectorSelfHealing.ts
 * Simple self‑healing loop and drift detection watchdog for VectorLayer.
 */
import VectorLayer from "./vectorLayer.js";
export declare class VectorSelfHealer {
    #private;
    constructor(layer: VectorLayer, intervalMs?: number);
    start(): void;
    stop(): void;
    check(): Promise<void>;
}
//# sourceMappingURL=vectorSelfHealing.d.ts.map