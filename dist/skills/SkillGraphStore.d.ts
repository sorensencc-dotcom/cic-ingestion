/**
 * Skill Graph Store (Phase 24.2)
 * Persistent capability graph with versioning and history
 */
import { SkillGraph, SkillNode, SkillEdge, CapabilitySet } from './models/SkillGraph';
export interface SkillGraphVersion {
    version: string;
    timestamp: string;
    changes: string[];
    author?: string;
    graph: SkillGraph;
}
/**
 * In-memory skill graph store with versioning
 */
export declare class SkillGraphStore {
    private currentGraph;
    private history;
    constructor();
    /**
     * Add a skill node to the graph
     */
    addNode(node: SkillNode): void;
    /**
     * Update a skill node
     */
    updateNode(nodeId: string, updates: Partial<SkillNode>): void;
    /**
     * Remove a skill node (and associated edges)
     */
    removeNode(nodeId: string): void;
    /**
     * Get a skill node by ID
     */
    getNode(nodeId: string): SkillNode | undefined;
    /**
     * Get all nodes of a specific type
     */
    getNodesByType(type: string): SkillNode[];
    /**
     * Add a skill edge to the graph
     */
    addEdge(edge: SkillEdge): void;
    /**
     * Remove a skill edge
     */
    removeEdge(edgeId: string): void;
    /**
     * Get edges for a specific node (incoming and outgoing)
     */
    getNodeEdges(nodeId: string): {
        incoming: SkillEdge[];
        outgoing: SkillEdge[];
    };
    /**
     * Get current graph
     */
    getGraph(): SkillGraph;
    /**
     * Get graph statistics
     */
    getStats(): Record<string, any>;
    /**
     * Save current graph as a new version
     */
    saveVersion(version: string, changes: string[]): void;
    /**
     * Get a specific version
     */
    getVersion(version: string): SkillGraphVersion | undefined;
    /**
     * Get version history
     */
    getVersionHistory(): SkillGraphVersion[];
    /**
     * Rollback to a previous version
     */
    rollbackToVersion(version: string): void;
    /**
     * Find skills that match a capability query
     */
    findCapabilities(query: {
        category?: string;
        type?: string;
        status?: string;
    }): SkillNode[];
    /**
     * Detect capability gaps
     */
    detectGaps(requiredCapabilities: string[]): string[];
    /**
     * Calculate capability coverage
     */
    calculateCapabilityCoverage(requiredCapabilities: string[]): number;
    /**
     * Create capability set snapshot
     */
    createCapabilitySet(name: string): CapabilitySet;
    /**
     * Detect redundant skills (same capability, multiple implementations)
     */
    private detectRedundancies;
    /**
     * Calculate drift score (capability vs expected)
     */
    calculateDrift(expectedCapabilities: Record<string, number>): number;
    /**
     * Clear all data (for testing)
     */
    clear(): void;
}
//# sourceMappingURL=SkillGraphStore.d.ts.map