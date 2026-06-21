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
var _TorqueQueryPlanner_instances, _TorqueQueryPlanner_targets, _TorqueQueryPlanner_fanIn, _TorqueQueryPlanner_rrfFuse, _TorqueQueryPlanner_mmrDiversify, _TorqueQueryPlanner_similarity, _TorqueQueryPlanner_computeFacets;
export class TorqueQueryPlanner {
    constructor(targets) {
        _TorqueQueryPlanner_instances.add(this);
        _TorqueQueryPlanner_targets.set(this, void 0);
        __classPrivateFieldSet(this, _TorqueQueryPlanner_targets, targets, "f");
    }
    getTargets() {
        return __classPrivateFieldGet(this, _TorqueQueryPlanner_targets, "f");
    }
    async execute(plan) {
        const perCollectionLimit = plan.limit;
        const resultsByCollection = {};
        const debug = {
            collectionsQueried: [],
            primaryResults: {},
            secondaryResults: {},
            rrfScores: {},
            mmrDecisions: [],
        };
        for (const target of plan.collections) {
            debug.collectionsQueried.push(target.name);
            const primary = await target.client.query(plan.vectorPrimary, perCollectionLimit);
            debug.primaryResults[target.name] = primary;
            let secondary = [];
            if (plan.vectorSecondary) {
                secondary = await target.client.query(plan.vectorSecondary, perCollectionLimit);
                debug.secondaryResults[target.name] = secondary;
            }
            const fused = __classPrivateFieldGet(this, _TorqueQueryPlanner_instances, "m", _TorqueQueryPlanner_rrfFuse).call(this, primary, secondary, perCollectionLimit, debug);
            resultsByCollection[target.name] = fused;
        }
        const fusedAll = __classPrivateFieldGet(this, _TorqueQueryPlanner_instances, "m", _TorqueQueryPlanner_fanIn).call(this, resultsByCollection, plan.limit);
        const diversified = __classPrivateFieldGet(this, _TorqueQueryPlanner_instances, "m", _TorqueQueryPlanner_mmrDiversify).call(this, fusedAll, 0.7, debug);
        const hits = diversified.map((r) => ({
            id: r.id,
            score: r.score,
            payload: r.payload,
            collection: r.payload?.collection ?? "unknown",
        }));
        const facets = plan.facets
            ? __classPrivateFieldGet(this, _TorqueQueryPlanner_instances, "m", _TorqueQueryPlanner_computeFacets).call(this, hits, plan.facets)
            : {};
        return { hits, facets, debug };
    }
}
_TorqueQueryPlanner_targets = new WeakMap(), _TorqueQueryPlanner_instances = new WeakSet(), _TorqueQueryPlanner_fanIn = function _TorqueQueryPlanner_fanIn(byCollection, limit) {
    const all = [];
    for (const [collection, list] of Object.entries(byCollection)) {
        for (const r of list) {
            all.push({
                ...r,
                payload: { ...(r.payload ?? {}), collection },
            });
        }
    }
    return all.sort((a, b) => b.score - a.score).slice(0, limit);
}, _TorqueQueryPlanner_rrfFuse = function _TorqueQueryPlanner_rrfFuse(a, b, limit, debug) {
    const k = 60;
    const scores = new Map();
    const payloads = new Map();
    const add = (list) => {
        list.forEach((r, idx) => {
            const key = r.id;
            const prev = scores.get(key) || 0;
            scores.set(key, prev + 1 / (k + idx));
            payloads.set(key, r.payload);
        });
    };
    add(a);
    add(b);
    const fused = Array.from(scores.entries())
        .map(([id, score]) => ({
        id,
        score,
        payload: payloads.get(id) ?? null,
    }))
        .sort((x, y) => y.score - x.score)
        .slice(0, limit);
    if (debug && debug.rrfScores) {
        for (const item of fused) {
            debug.rrfScores[item.id] = item.score;
        }
    }
    return fused;
}, _TorqueQueryPlanner_mmrDiversify = function _TorqueQueryPlanner_mmrDiversify(results, lambda, debug) {
    if (results.length <= 1)
        return results;
    const selected = [];
    const remaining = [...results];
    while (remaining.length > 0 && selected.length < results.length) {
        let bestIdx = 0;
        let bestScore = -Infinity;
        let bestDetails = null;
        for (let i = 0; i < remaining.length; i++) {
            const candidate = remaining[i];
            const relevance = candidate.score;
            const redundancy = selected.length
                ? Math.max(...selected.map((s) => __classPrivateFieldGet(this, _TorqueQueryPlanner_instances, "m", _TorqueQueryPlanner_similarity).call(this, s, candidate)))
                : 0;
            const mmrScore = lambda * relevance - (1 - lambda) * redundancy;
            if (mmrScore > bestScore) {
                bestScore = mmrScore;
                bestIdx = i;
                if (debug) {
                    bestDetails = {
                        candidate: candidate.id,
                        relevance,
                        redundancy,
                        mmrScore,
                    };
                }
            }
        }
        if (debug && debug.mmrDecisions && bestDetails) {
            debug.mmrDecisions.push(bestDetails);
        }
        selected.push(remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
    }
    return selected;
}, _TorqueQueryPlanner_similarity = function _TorqueQueryPlanner_similarity(a, b) {
    return a.id === b.id ? 1 : 0;
}, _TorqueQueryPlanner_computeFacets = function _TorqueQueryPlanner_computeFacets(hits, facetKeys) {
    const facets = {};
    for (const key of facetKeys) {
        facets[key] = {};
    }
    for (const hit of hits) {
        const payload = hit.payload || {};
        for (const key of facetKeys) {
            const value = payload[key];
            if (value == null)
                continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    const s = String(v);
                    facets[key][s] = (facets[key][s] || 0) + 1;
                }
            }
            else {
                const s = String(value);
                facets[key][s] = (facets[key][s] || 0) + 1;
            }
        }
    }
    return facets;
};
export default TorqueQueryPlanner;
//# sourceMappingURL=torqueQueryPlanner.js.map
