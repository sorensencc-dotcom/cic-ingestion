/**
 * Phase 25 → Phase 26 Caveman Adapter
 * Wires Caveman compression into TorqueQuery ingestion pipeline
 */
import { createCavemanStats } from './CavemanStats.js';
export class Phase25To26CavemanAdapter {
    constructor(caveman) {
        this.caveman = caveman;
    }
    toTorqueBundle(ckos, kgp) {
        const stableCkos = ckos.filter((c) => c.stability === 'STABLE');
        const nodes = stableCkos
            .sort((a, b) => this.orderType(a.type) - this.orderType(b.type))
            .map((cko) => ({
            id: cko.id,
            type: cko.type,
            attributes: cko.attributes,
            version: cko.version,
            stability: cko.stability,
        }));
        const nodeIds = new Set(nodes.map((n) => n.id));
        const edges = kgp.edges_added.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
        // Caveman compression applied to bundle payload
        const payload = { nodes, edges };
        const payloadJson = JSON.stringify(payload);
        const bytesIn = payloadJson.length;
        const compressed = this.caveman.compress(payload);
        const compressedJson = JSON.stringify(compressed.data);
        const bytesOut = compressedJson.length;
        const stats = createCavemanStats(bytesIn, bytesOut, {
            arrays_processed: nodes.length + edges.length,
            objects_processed: ckos.length,
            recompression_blocked: false,
            pipeline_stage: 'torque.ingestion',
            phase_id: 25,
            hash: this.hashPayload(payload),
        });
        return {
            bundle_id: `tq-bundle:${Date.now()}`,
            nodes: compressed.data.nodes,
            edges: compressed.data.edges,
            manifest: {
                source_phase: 25,
                patch_id: kgp.patch_id,
                created_at: new Date().toISOString(),
            },
            CAVEMAN_STATS: stats,
        };
    }
    orderType(type) {
        switch (type) {
            case 'entity':
                return 1;
            case 'event':
                return 2;
            case 'timeline':
                return 3;
            case 'location':
                return 4;
            default:
                return 99;
        }
    }
    hashPayload(payload) {
        // Simple hash for traceability (not cryptographic)
        const str = JSON.stringify(payload);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `0x${(hash >>> 0).toString(16).padStart(8, '0')}`;
    }
}
//# sourceMappingURL=Phase25To26CavemanAdapter.js.map