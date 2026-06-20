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
var _QdrantObservability_client, _QdrantObservability_lastSearchLatencyMs, _QdrantObservability_lastIndexLatencyMs;
export class QdrantObservability {
    constructor(client) {
        _QdrantObservability_client.set(this, void 0);
        _QdrantObservability_lastSearchLatencyMs.set(this, null);
        _QdrantObservability_lastIndexLatencyMs.set(this, null);
        __classPrivateFieldSet(this, _QdrantObservability_client, client, "f");
    }
    recordSearchLatency(ms) {
        __classPrivateFieldSet(this, _QdrantObservability_lastSearchLatencyMs, ms, "f");
    }
    recordIndexLatency(ms) {
        __classPrivateFieldSet(this, _QdrantObservability_lastIndexLatencyMs, ms, "f");
    }
    async healthSummary() {
        const healthy = await __classPrivateFieldGet(this, _QdrantObservability_client, "f").health();
        return {
            collection: __classPrivateFieldGet(this, _QdrantObservability_client, "f").collectionName(),
            healthy,
        };
    }
    async metrics() {
        const healthy = await __classPrivateFieldGet(this, _QdrantObservability_client, "f").health();
        let pointCount = null;
        let indexStatus = null;
        try {
            const stats = await __classPrivateFieldGet(this, _QdrantObservability_client, "f").stats();
            pointCount = stats.points_count ?? null;
            indexStatus = stats.indexing ?? null;
        }
        catch {
            // leave null
        }
        return {
            collection: __classPrivateFieldGet(this, _QdrantObservability_client, "f").collectionName(),
            healthy,
            pointCount,
            indexStatus,
            lastSearchLatencyMs: __classPrivateFieldGet(this, _QdrantObservability_lastSearchLatencyMs, "f"),
            lastIndexLatencyMs: __classPrivateFieldGet(this, _QdrantObservability_lastIndexLatencyMs, "f"),
        };
    }
}
_QdrantObservability_client = new WeakMap(), _QdrantObservability_lastSearchLatencyMs = new WeakMap(), _QdrantObservability_lastIndexLatencyMs = new WeakMap();
export default QdrantObservability;
//# sourceMappingURL=qdrantObservability.js.map