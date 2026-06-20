/**
 * Phase 25 → Phase 26 Caveman Adapter
 * Wires Caveman compression into TorqueQuery ingestion pipeline
 */

import { CavemanCompressor } from '../autonomy/CavemanCompressor.js';
import { CavemanStatsV1, createCavemanStats } from './CavemanStats.js';

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

export class Phase25To26CavemanAdapter {
  private readonly caveman: CavemanCompressor;

  constructor(caveman: CavemanCompressor) {
    this.caveman = caveman;
  }

  public toTorqueBundle(
    ckos: ConsolidatedKnowledgeObject[],
    kgp: KnowledgeGraphPatch
  ): TorqueQueryIngestionBundle & { CAVEMAN_STATS: CavemanStatsV1 } {
    const stableCkos = ckos.filter((c) => c.stability === 'STABLE');

    const nodes: TorqueNode[] = stableCkos
      .sort((a, b) => this.orderType(a.type) - this.orderType(b.type))
      .map((cko) => ({
        id: cko.id,
        type: cko.type,
        attributes: cko.attributes,
        version: cko.version,
        stability: cko.stability,
      }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges: TorqueEdge[] = kgp.edges_added.filter(
      (e) => nodeIds.has(e.from) && nodeIds.has(e.to)
    );

    // Caveman compression applied to bundle payload
    const payload = { nodes, edges };
    const payloadJson = JSON.stringify(payload);
    const bytesIn = payloadJson.length;

    const compressed = this.caveman.compress(payload);
    const compressedJson = JSON.stringify(compressed.data);
    const bytesOut = compressedJson.length;

    const stats: CavemanStatsV1 = createCavemanStats(bytesIn, bytesOut, {
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

  private orderType(type: string): number {
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

  private hashPayload(payload: any): string {
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

