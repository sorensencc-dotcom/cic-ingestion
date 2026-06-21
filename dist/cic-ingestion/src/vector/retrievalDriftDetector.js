/**
 * retrievalDriftDetector.ts
 * Compares current rankings against golden snapshots and raises alerts on drift.
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
var _RetrievalDriftDetector_instances, _RetrievalDriftDetector_planner, _RetrievalDriftDetector_layer, _RetrievalDriftDetector_golden, _RetrievalDriftDetector_computeDriftScore;
import fs from "node:fs";
import path from "node:path";
import { TorqueQueryPlanner } from "./torqueQueryPlanner.js";
export class RetrievalDriftDetector {
    constructor(layer) {
        _RetrievalDriftDetector_instances.add(this);
        _RetrievalDriftDetector_planner.set(this, void 0);
        _RetrievalDriftDetector_layer.set(this, void 0);
        _RetrievalDriftDetector_golden.set(this, void 0);
        __classPrivateFieldSet(this, _RetrievalDriftDetector_layer, layer, "f");
        __classPrivateFieldSet(this, _RetrievalDriftDetector_planner, new TorqueQueryPlanner({
            chunks: { name: "chunks", client: layer.chunks.client },
            context: { name: "context", client: layer.context.client },
            skills: { name: "skills", client: layer.skills.client },
        }), "f");
        const goldenPath = path.join(process.cwd(), "src/vector/goldenQueries.json");
        __classPrivateFieldSet(this, _RetrievalDriftDetector_golden, JSON.parse(fs.readFileSync(goldenPath, "utf8")), "f");
    }
    async check(threshold = 0.3) {
        const alerts = [];
        for (const gq of __classPrivateFieldGet(this, _RetrievalDriftDetector_golden, "f")) {
            const res = await __classPrivateFieldGet(this, _RetrievalDriftDetector_planner, "f").execute({
                vectorPrimary: gq.vectorPrimary,
                limit: gq.expectedTopIds.length,
                collections: gq.collections.map((name) => ({
                    name,
                    client: name === "chunks"
                        ? __classPrivateFieldGet(this, _RetrievalDriftDetector_layer, "f").chunks.client
                        : name === "context"
                            ? __classPrivateFieldGet(this, _RetrievalDriftDetector_layer, "f").context.client
                            : __classPrivateFieldGet(this, _RetrievalDriftDetector_layer, "f").skills.client,
                })),
                facets: [],
            });
            const actualIds = res.hits.map((h) => h.id);
            const driftScore = __classPrivateFieldGet(this, _RetrievalDriftDetector_instances, "m", _RetrievalDriftDetector_computeDriftScore).call(this, gq.expectedTopIds, actualIds);
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
}
_RetrievalDriftDetector_planner = new WeakMap(), _RetrievalDriftDetector_layer = new WeakMap(), _RetrievalDriftDetector_golden = new WeakMap(), _RetrievalDriftDetector_instances = new WeakSet(), _RetrievalDriftDetector_computeDriftScore = function _RetrievalDriftDetector_computeDriftScore(expected, actual) {
    // Simple normalized Hamming distance over top-N
    let diff = 0;
    const n = Math.max(expected.length, actual.length);
    for (let i = 0; i < n; i++) {
        if (expected[i] !== actual[i])
            diff++;
    }
    return n === 0 ? 0 : diff / n;
};
//# sourceMappingURL=retrievalDriftDetector.js.map
