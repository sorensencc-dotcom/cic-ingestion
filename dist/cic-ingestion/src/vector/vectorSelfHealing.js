/**
 * vectorSelfHealing.ts
 * Simple self‑healing loop and drift detection watchdog for VectorLayer.
 */
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _VectorSelfHealer_layer, _VectorSelfHealer_intervalMs, _VectorSelfHealer_timer, _VectorSelfHealer_driftDetector;
import { RetrievalDriftDetector } from "./retrievalDriftDetector.js";
export class VectorSelfHealer {
    constructor(layer, intervalMs = 30000) {
        _VectorSelfHealer_layer.set(this, void 0);
        _VectorSelfHealer_intervalMs.set(this, void 0);
        _VectorSelfHealer_timer.set(this, null);
        _VectorSelfHealer_driftDetector.set(this, void 0);
        __classPrivateFieldSet(this, _VectorSelfHealer_layer, layer, "f");
        __classPrivateFieldSet(this, _VectorSelfHealer_intervalMs, intervalMs, "f");
        __classPrivateFieldSet(this, _VectorSelfHealer_driftDetector, new RetrievalDriftDetector(layer), "f");
    }
    start() {
        if (__classPrivateFieldGet(this, _VectorSelfHealer_timer, "f"))
            return;
        __classPrivateFieldSet(this, _VectorSelfHealer_timer, setInterval(() => {
            this.check().catch((err) => console.error("VectorSelfHealer: check error", err));
        }, __classPrivateFieldGet(this, _VectorSelfHealer_intervalMs, "f")), "f");
    }
    stop() {
        if (!__classPrivateFieldGet(this, _VectorSelfHealer_timer, "f"))
            return;
        clearInterval(__classPrivateFieldGet(this, _VectorSelfHealer_timer, "f"));
        __classPrivateFieldSet(this, _VectorSelfHealer_timer, null, "f");
    }
    async check() {
        const health = await __classPrivateFieldGet(this, _VectorSelfHealer_layer, "f").health();
        const unhealthy = Object.entries(health)
            .filter(([, ok]) => !ok)
            .map(([name]) => name);
        if (unhealthy.length > 0) {
            console.error("VectorSelfHealer: unhealthy collections", unhealthy);
            // Deterministic remediation: re‑ensure collections.
            await __classPrivateFieldGet(this, _VectorSelfHealer_layer, "f").ensureCollections();
        }
        // Run retrieval drift check if collections are healthy
        if (unhealthy.length === 0) {
            try {
                const driftAlerts = await __classPrivateFieldGet(this, _VectorSelfHealer_driftDetector, "f").check(0.3);
                if (driftAlerts.length > 0) {
                    console.warn("VectorSelfHealer: retrieval drift detected", driftAlerts);
                }
            }
            catch (err) {
                console.error("VectorSelfHealer: drift check error", err);
            }
        }
    }
}
_VectorSelfHealer_layer = new WeakMap(), _VectorSelfHealer_intervalMs = new WeakMap(), _VectorSelfHealer_timer = new WeakMap(), _VectorSelfHealer_driftDetector = new WeakMap();
//# sourceMappingURL=vectorSelfHealing.js.map
