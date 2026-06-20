/**
 * qdrantClient.ts
 * CIC Ingestion — Qdrant Vector DB Client
 * v1.0.0 — 2026-06-14
 *
 * Deterministic, operator‑grade implementation for CIC Phase 26 (TorqueQuery).
 * No hidden retries. No silent fallbacks. Strict boundary validation.
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
var _QdrantClient_instances, _QdrantClient_url, _QdrantClient_apiKey, _QdrantClient_collection, _QdrantClient_vectorSize, _QdrantClient_headers, _QdrantClient_req;
import assert from "node:assert";
export class QdrantClient {
    constructor(opts) {
        _QdrantClient_instances.add(this);
        _QdrantClient_url.set(this, void 0);
        _QdrantClient_apiKey.set(this, void 0);
        _QdrantClient_collection.set(this, void 0);
        _QdrantClient_vectorSize.set(this, void 0);
        _QdrantClient_headers.set(this, void 0);
        assert(opts.url, "QdrantClient: url is required");
        assert(opts.collection, "QdrantClient: collection is required");
        assert(Number.isInteger(opts.vectorSize) && opts.vectorSize > 0, "QdrantClient: vectorSize must be a positive integer");
        __classPrivateFieldSet(this, _QdrantClient_url, opts.url.replace(/\/$/, ""), "f");
        __classPrivateFieldSet(this, _QdrantClient_apiKey, opts.apiKey, "f");
        __classPrivateFieldSet(this, _QdrantClient_collection, opts.collection, "f");
        __classPrivateFieldSet(this, _QdrantClient_vectorSize, opts.vectorSize, "f");
        __classPrivateFieldSet(this, _QdrantClient_headers, {
            "Content-Type": "application/json",
        }, "f");
        if (__classPrivateFieldGet(this, _QdrantClient_apiKey, "f")) {
            __classPrivateFieldGet(this, _QdrantClient_headers, "f")["api-key"] = __classPrivateFieldGet(this, _QdrantClient_apiKey, "f");
        }
    }
    // Method for the collection name, needed for testing or indexing
    collectionName() {
        return __classPrivateFieldGet(this, _QdrantClient_collection, "f");
    }
    // Getter for the vector size, needed for validation
    get vectorSize() {
        return __classPrivateFieldGet(this, _QdrantClient_vectorSize, "f");
    }
    //
    // ────────────────────────────────────────────────────────────────
    //   Public API
    // ────────────────────────────────────────────────────────────────
    //
    async ensureCollection() {
        const path = `/collections/${__classPrivateFieldGet(this, _QdrantClient_collection, "f")}`;
        // Check if exists
        const exists = await fetch(`${__classPrivateFieldGet(this, _QdrantClient_url, "f")}${path}`, {
            method: "GET",
            headers: __classPrivateFieldGet(this, _QdrantClient_headers, "f"),
        });
        if (exists.status === 200) {
            return;
        }
        if (exists.status !== 404) {
            const body = await exists.text();
            throw new Error(`QdrantClient: unexpected response checking collection: ${exists.status} ${body}`);
        }
        // Create collection
        await __classPrivateFieldGet(this, _QdrantClient_instances, "m", _QdrantClient_req).call(this, path, {
            method: "PUT",
            body: JSON.stringify({
                vectors: {
                    size: __classPrivateFieldGet(this, _QdrantClient_vectorSize, "f"),
                    distance: "Cosine",
                },
            }),
        });
    }
    async createFieldIndex(fieldName, fieldType) {
        assert(fieldName, "createFieldIndex: fieldName is required");
        assert(fieldType, "createFieldIndex: fieldType is required");
        await __classPrivateFieldGet(this, _QdrantClient_instances, "m", _QdrantClient_req).call(this, `/collections/${__classPrivateFieldGet(this, _QdrantClient_collection, "f")}/index`, {
            method: "PUT",
            body: JSON.stringify({
                field_name: fieldName,
                field_schema: fieldType,
            }),
        });
    }
    async upsert(points) {
        assert(Array.isArray(points), "upsert: points must be an array");
        for (const p of points) {
            assert(typeof p.id === "string", "upsert: point.id must be string");
            assert(Array.isArray(p.vector) &&
                p.vector.length === __classPrivateFieldGet(this, _QdrantClient_vectorSize, "f") &&
                p.vector.every((n) => typeof n === "number"), `upsert: point.vector must be number[${__classPrivateFieldGet(this, _QdrantClient_vectorSize, "f")}]`);
        }
        await __classPrivateFieldGet(this, _QdrantClient_instances, "m", _QdrantClient_req).call(this, `/collections/${__classPrivateFieldGet(this, _QdrantClient_collection, "f")}/points`, {
            method: "PUT",
            body: JSON.stringify({ points }),
        });
    }
    async query(vector, limit) {
        assert(Array.isArray(vector) &&
            vector.length === __classPrivateFieldGet(this, _QdrantClient_vectorSize, "f") &&
            vector.every((n) => typeof n === "number"), `query: vector must be number[${__classPrivateFieldGet(this, _QdrantClient_vectorSize, "f")}]`);
        assert(Number.isInteger(limit) && limit > 0, "query: limit must be a positive integer");
        const res = await __classPrivateFieldGet(this, _QdrantClient_instances, "m", _QdrantClient_req).call(this, `/collections/${__classPrivateFieldGet(this, _QdrantClient_collection, "f")}/points/search`, {
            method: "POST",
            body: JSON.stringify({
                vector,
                limit,
            }),
        });
        if (!Array.isArray(res.result))
            return [];
        return res.result.map((r) => ({
            id: String(r.id),
            score: r.score,
            payload: r.payload ?? null,
        }));
    }
    async delete(ids) {
        assert(Array.isArray(ids), "delete: ids must be an array");
        await __classPrivateFieldGet(this, _QdrantClient_instances, "m", _QdrantClient_req).call(this, `/collections/${__classPrivateFieldGet(this, _QdrantClient_collection, "f")}/points/delete`, {
            method: "POST",
            body: JSON.stringify({ points: ids }),
        });
    }
    async health() {
        try {
            const res = await fetch(`${__classPrivateFieldGet(this, _QdrantClient_url, "f")}/healthz`, {
                method: "GET",
                headers: __classPrivateFieldGet(this, _QdrantClient_headers, "f"),
            });
            // /healthz returns plain text "healthz check passed", not JSON
            return res.status === 200;
        }
        catch {
            return false;
        }
    }
    async stats() {
        const res = await __classPrivateFieldGet(this, _QdrantClient_instances, "m", _QdrantClient_req).call(this, `/collections/${__classPrivateFieldGet(this, _QdrantClient_collection, "f")}`, {
            method: "GET",
        });
        return {
            points_count: res?.result?.points_count ?? 0,
            indexing: typeof res?.result?.optimizer_status === "string"
                ? res.result.optimizer_status
                : res?.result?.status ?? "unknown",
        };
    }
}
_QdrantClient_url = new WeakMap(), _QdrantClient_apiKey = new WeakMap(), _QdrantClient_collection = new WeakMap(), _QdrantClient_vectorSize = new WeakMap(), _QdrantClient_headers = new WeakMap(), _QdrantClient_instances = new WeakSet(), _QdrantClient_req = 
//
// ────────────────────────────────────────────────────────────────
//   Internal HTTP helper
// ────────────────────────────────────────────────────────────────
//
async function _QdrantClient_req(path, init) {
    const url = `${__classPrivateFieldGet(this, _QdrantClient_url, "f")}${path}`;
    const res = await fetch(url, {
        ...init,
        headers: __classPrivateFieldGet(this, _QdrantClient_headers, "f"),
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    }
    catch {
        throw new Error(`QdrantClient: invalid JSON response from ${path}: ${text}`);
    }
    if (!res.ok) {
        throw new Error(`QdrantClient: HTTP ${res.status} ${res.statusText} — ${JSON.stringify(json)}`);
    }
    return json;
};
export default QdrantClient;
//# sourceMappingURL=qdrantClient.js.map