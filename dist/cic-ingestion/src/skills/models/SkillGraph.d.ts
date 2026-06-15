/**
 * Skill Graph Models (Phase 24.1)
 * Nodes: skills, instincts, hooks, rules, agents
 * Edges: depends_on, enhances, conflicts_with
 */
export type NodeType = 'skill' | 'instinct' | 'hook' | 'rule' | 'agent';
export type EdgeType = 'depends_on' | 'enhances' | 'conflicts_with' | 'provides' | 'requires';
export interface SkillNode {
    id: string;
    type: NodeType;
    name: string;
    description: string;
    category?: string;
    status: 'active' | 'inactive' | 'deprecated' | 'experimental';
    version: string;
    confidence: number;
    metadata: {
        source?: string;
        lastUpdated: string;
        discoveredAt: string;
        usage_count?: number;
        successRate?: number;
    };
    capabilities?: string[];
    requirements?: string[];
}
export interface SkillEdge {
    id: string;
    fromNode: string;
    toNode: string;
    type: EdgeType;
    strength: number;
    description?: string;
    conditions?: Record<string, any>;
    metadata: {
        discoveredAt: string;
        confidence: number;
    };
}
export interface SkillGraph {
    id: string;
    version: string;
    timestamp: string;
    nodes: Map<string, SkillNode>;
    edges: Map<string, SkillEdge>;
    metadata: {
        totalNodes: number;
        totalEdges: number;
        byType: Record<NodeType, number>;
        lastUpdatedAt: string;
        driftScore?: number;
    };
}
export interface CapabilitySet {
    id: string;
    name: string;
    skills: SkillNode[];
    coverage: number;
    gaps: string[];
    redundancies: string[];
    timestamp: string;
}
export interface SkillPath {
    source: SkillNode;
    target: SkillNode;
    path: SkillNode[];
    distance: number;
    strength: number;
}
/**
 * CIC capability categories
 */
export declare const SKILL_CATEGORIES: {
    readonly MEMORY: "memory";
    readonly REASONING: "reasoning";
    readonly PLANNING: "planning";
    readonly EXECUTION: "execution";
    readonly GOVERNANCE: "governance";
    readonly INTEGRATION: "integration";
    readonly OBSERVABILITY: "observability";
    readonly LEARNING: "learning";
};
/**
 * Standard node types for CIC
 */
export declare const CIC_NODE_TYPES: {
    readonly SIGNAL_DETECTION: "skill:signal_detection";
    readonly PROPOSAL_GENERATION: "skill:proposal_generation";
    readonly MEMORY_QUERYING: "skill:memory_querying";
    readonly PLAN_SYNTHESIS: "skill:plan_synthesis";
    readonly TASK_EXECUTION: "skill:task_execution";
    readonly GOVERNANCE_VOTING: "skill:governance_voting";
    readonly DRIFT_DETECTION: "instinct:drift_detection";
    readonly STABILITY_MONITORING: "instinct:stability_monitoring";
    readonly ERROR_RECOVERY: "instinct:error_recovery";
    readonly ON_SIGNAL_DETECTED: "hook:on_signal_detected";
    readonly ON_PROPOSAL_APPROVED: "hook:on_proposal_approved";
    readonly ON_GOVERNANCE_DECISION: "hook:on_governance_decision";
    readonly APPROVAL_THRESHOLD: "rule:approval_threshold";
    readonly DRIFT_TOLERANCE: "rule:drift_tolerance";
    readonly ESCALATION_POLICY: "rule:escalation_policy";
    readonly SIGNAL_DETECTOR: "agent:signal_detector";
    readonly PROPOSAL_ENGINE: "agent:proposal_engine";
    readonly PLANNER: "agent:planner";
    readonly ORCHESTRATOR: "agent:orchestrator";
};
/**
 * Create a new skill node
 */
export declare function createSkillNode(id: string, type: NodeType, name: string, description: string, category?: string): SkillNode;
/**
 * Create a new skill edge
 */
export declare function createSkillEdge(id: string, fromNode: string, toNode: string, type: EdgeType, strength?: number): SkillEdge;
/**
 * Calculate graph density (connectivity)
 */
export declare function calculateGraphDensity(graph: SkillGraph): number;
/**
 * Find connected components in skill graph
 */
export declare function findConnectedComponents(graph: SkillGraph): SkillNode[][];
/**
 * Find shortest path between two nodes
 */
export declare function findShortestPath(graph: SkillGraph, sourceId: string, targetId: string): SkillPath | null;
//# sourceMappingURL=SkillGraph.d.ts.map