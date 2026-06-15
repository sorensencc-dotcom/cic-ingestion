/**
 * Phase 25 → Phase 26 Caveman Adapter
 * Wires Caveman compression into TorqueQuery ingestion pipeline
 */
import { CavemanCompressor } from '../autonomy/CavemanCompressor';
import { CavemanStatsV1 } from './CavemanStats';
export interface ConsolidatedKnowledgeObject {
    id: string;
    type: string;
    attributes: Record<string, any>;
    version: number;
    stability: 'STABLE' | 'TENTATIVE';
}
export interface KnowledgeGraphPatch {
    patch_id: string;
    edges_added: Array<{
        from: string;
        to: string;
        type?: string;
        properties?: Record<string, any>;
    }>;
}
export interface TorqueNode {
    id: string;
    type: string;
    attributes: Record<string, any>;
    version: number;
    stability: 'STABLE' | 'TENTATIVE';
}
export interface TorqueEdge {
    from: string;
    to: string;
    type?: string;
    properties?: Record<string, any>;
}
export interface TorqueQueryIngestionBundle {
    bundle_id: string;
    nodes: TorqueNode[];
    edges: TorqueEdge[];
    manifest: {
        source_phase: number;
        patch_id: string;
        created_at: string;
    };
}
export declare class Phase25To26CavemanAdapter {
    private readonly caveman;
    constructor(caveman: CavemanCompressor);
    toTorqueBundle(ckos: ConsolidatedKnowledgeObject[], kgp: KnowledgeGraphPatch): TorqueQueryIngestionBundle & {
        CAVEMAN_STATS: CavemanStatsV1;
    };
    private orderType;
    private hashPayload;
}
//# sourceMappingURL=Phase25To26CavemanAdapter.d.ts.map