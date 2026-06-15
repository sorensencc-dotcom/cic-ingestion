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
var _HarvesterIndexer_client, _HarvesterIndexer_observability;
export class HarvesterIndexer {
    constructor(client, observability) {
        _HarvesterIndexer_client.set(this, void 0);
        _HarvesterIndexer_observability.set(this, void 0);
        __classPrivateFieldSet(this, _HarvesterIndexer_client, client, "f");
        __classPrivateFieldSet(this, _HarvesterIndexer_observability, observability, "f");
    }
    async indexChunk(chunk) {
        const point = {
            id: chunk.id,
            vector: chunk.vector,
            payload: {
                doc_id: chunk.docId,
                chunk_id: chunk.id,
                source_path: chunk.sourcePath,
                timestamp: chunk.timestamp,
                tags: chunk.tags,
                people: chunk.people,
                places: chunk.places,
                metadata: chunk.metadata,
                text: chunk.text,
            },
        };
        const start = performance.now();
        await __classPrivateFieldGet(this, _HarvesterIndexer_client, "f").upsert([point]);
        if (__classPrivateFieldGet(this, _HarvesterIndexer_observability, "f")) {
            __classPrivateFieldGet(this, _HarvesterIndexer_observability, "f").recordIndexLatency(performance.now() - start);
        }
    }
    async bulkIndex(chunks) {
        const points = chunks.map((chunk) => ({
            id: chunk.id,
            vector: chunk.vector,
            payload: {
                doc_id: chunk.docId,
                chunk_id: chunk.id,
                source_path: chunk.sourcePath,
                timestamp: chunk.timestamp,
                tags: chunk.tags,
                people: chunk.people,
                places: chunk.places,
                metadata: chunk.metadata,
                text: chunk.text,
            },
        }));
        const start = performance.now();
        await __classPrivateFieldGet(this, _HarvesterIndexer_client, "f").upsert(points);
        if (__classPrivateFieldGet(this, _HarvesterIndexer_observability, "f")) {
            __classPrivateFieldGet(this, _HarvesterIndexer_observability, "f").recordIndexLatency(performance.now() - start);
        }
    }
}
_HarvesterIndexer_client = new WeakMap(), _HarvesterIndexer_observability = new WeakMap();
export default HarvesterIndexer;
//# sourceMappingURL=harvesterIndexer.js.map