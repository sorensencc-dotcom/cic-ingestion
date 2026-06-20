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
var _TorqueQueryEngine_client, _TorqueQueryEngine_observability;
export class TorqueQueryEngine {
    constructor(client, observability) {
        _TorqueQueryEngine_client.set(this, void 0);
        _TorqueQueryEngine_observability.set(this, void 0);
        __classPrivateFieldSet(this, _TorqueQueryEngine_client, client, "f");
        __classPrivateFieldSet(this, _TorqueQueryEngine_observability, observability, "f");
    }
    async search(req) {
        const start = performance.now();
        const results = await __classPrivateFieldGet(this, _TorqueQueryEngine_client, "f").query(req.vector, req.limit);
        if (__classPrivateFieldGet(this, _TorqueQueryEngine_observability, "f")) {
            __classPrivateFieldGet(this, _TorqueQueryEngine_observability, "f").recordSearchLatency(performance.now() - start);
        }
        return results.map((r) => ({
            id: r.id,
            score: r.score,
            payload: r.payload,
        }));
    }
}
_TorqueQueryEngine_client = new WeakMap(), _TorqueQueryEngine_observability = new WeakMap();
export default TorqueQueryEngine;
//# sourceMappingURL=torqueQuery.js.map