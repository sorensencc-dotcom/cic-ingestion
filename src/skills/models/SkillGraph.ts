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
  category?: string; // e.g., 'memory', 'reasoning', 'planning', 'execution'
  status: 'active' | 'inactive' | 'deprecated' | 'experimental';
  version: string;
  confidence: number; // 0.0–1.0 (confidence in availability)
  metadata: {
    source?: string; // where this skill came from
    lastUpdated: string; // ISO 8601
    discoveredAt: string; // ISO 8601
    usage_count?: number;
    successRate?: number;
  };
  capabilities?: string[]; // what this skill can do
  requirements?: string[]; // what this skill needs
}

export interface SkillEdge {
  id: string;
  fromNode: string; // source node ID
  toNode: string; // target node ID
  type: EdgeType;
  strength: number; // 0.0–1.0 (how strong the relationship)
  description?: string;
  conditions?: Record<string, any>; // when this edge is valid
  metadata: {
    discoveredAt: string; // ISO 8601
    confidence: number;
  };
}

export interface SkillGraph {
  id: string;
  version: string;
  timestamp: string; // ISO 8601
  nodes: Map<string, SkillNode>;
  edges: Map<string, SkillEdge>;
  metadata: {
    totalNodes: number;
    totalEdges: number;
    byType: Record<NodeType, number>;
    lastUpdatedAt: string;
    driftScore?: number; // capability drift vs expected
  };
}

export interface CapabilitySet {
  id: string;
  name: string;
  skills: SkillNode[];
  coverage: number; // percentage of expected capabilities
  gaps: string[]; // missing skills
  redundancies: string[]; // duplicate skills
  timestamp: string; // ISO 8601
}

export interface SkillPath {
  source: SkillNode;
  target: SkillNode;
  path: SkillNode[]; // intermediate nodes
  distance: number; // hop count
  strength: number; // combined edge strength
}

/**
 * CIC capability categories
 */
export const SKILL_CATEGORIES = {
  MEMORY: 'memory', // memory layer, storage, retrieval
  REASONING: 'reasoning', // signal detection, analysis, inference
  PLANNING: 'planning', // roadmap, task decomposition, scheduling
  EXECUTION: 'execution', // runtime, orchestration, agent management
  GOVERNANCE: 'governance', // voting, approval, policy enforcement
  INTEGRATION: 'integration', // bridges, APIs, cross-system communication
  OBSERVABILITY: 'observability', // monitoring, metrics, dashboards
  LEARNING: 'learning', // feedback loops, threshold tuning
} as const;

/**
 * Standard node types for CIC
 */
export const CIC_NODE_TYPES = {
  // Skills
  SIGNAL_DETECTION: 'skill:signal_detection',
  PROPOSAL_GENERATION: 'skill:proposal_generation',
  MEMORY_QUERYING: 'skill:memory_querying',
  PLAN_SYNTHESIS: 'skill:plan_synthesis',
  TASK_EXECUTION: 'skill:task_execution',
  GOVERNANCE_VOTING: 'skill:governance_voting',

  // Instincts (reflexive behaviors)
  DRIFT_DETECTION: 'instinct:drift_detection',
  STABILITY_MONITORING: 'instinct:stability_monitoring',
  ERROR_RECOVERY: 'instinct:error_recovery',

  // Hooks (event handlers)
  ON_SIGNAL_DETECTED: 'hook:on_signal_detected',
  ON_PROPOSAL_APPROVED: 'hook:on_proposal_approved',
  ON_GOVERNANCE_DECISION: 'hook:on_governance_decision',

  // Rules (policies)
  APPROVAL_THRESHOLD: 'rule:approval_threshold',
  DRIFT_TOLERANCE: 'rule:drift_tolerance',
  ESCALATION_POLICY: 'rule:escalation_policy',

  // Agents (sub-systems)
  SIGNAL_DETECTOR: 'agent:signal_detector',
  PROPOSAL_ENGINE: 'agent:proposal_engine',
  PLANNER: 'agent:planner',
  ORCHESTRATOR: 'agent:orchestrator',
} as const;

/**
 * Create a new skill node
 */
export function createSkillNode(
  id: string,
  type: NodeType,
  name: string,
  description: string,
  category?: string
): SkillNode {
  return {
    id,
    type,
    name,
    description,
    category,
    status: 'active',
    version: '1.0.0',
    confidence: 0.8,
    metadata: {
      lastUpdated: new Date().toISOString(),
      discoveredAt: new Date().toISOString(),
      usage_count: 0,
      successRate: 0.0,
    },
  };
}

/**
 * Create a new skill edge
 */
export function createSkillEdge(
  id: string,
  fromNode: string,
  toNode: string,
  type: EdgeType,
  strength: number = 0.8
): SkillEdge {
  return {
    id,
    fromNode,
    toNode,
    type,
    strength: Math.max(0, Math.min(1, strength)),
    metadata: {
      discoveredAt: new Date().toISOString(),
      confidence: 0.8,
    },
  };
}

/**
 * Calculate graph density (connectivity)
 */
export function calculateGraphDensity(graph: SkillGraph): number {
  const nodes = graph.nodes.size;
  if (nodes <= 1) return 0;

  const maxEdges = nodes * (nodes - 1); // directed graph
  const actualEdges = graph.edges.size;

  return actualEdges / maxEdges;
}

/**
 * Find connected components in skill graph
 */
export function findConnectedComponents(graph: SkillGraph): SkillNode[][] {
  const visited = new Set<string>();
  const components: SkillNode[][] = [];

  for (const [nodeId, node] of graph.nodes) {
    if (!visited.has(nodeId)) {
      const component = dfsComponent(nodeId, graph, visited);
      if (component.length > 0) {
        components.push(component);
      }
    }
  }

  return components;
}

/**
 * DFS to find connected component
 */
function dfsComponent(
  nodeId: string,
  graph: SkillGraph,
  visited: Set<string>
): SkillNode[] {
  const component: SkillNode[] = [];
  const stack = [nodeId];

  while (stack.length > 0) {
    const id = stack.pop()!;

    if (visited.has(id)) continue;

    visited.add(id);
    const node = graph.nodes.get(id);
    if (node) {
      component.push(node);

      // Find connected edges
      for (const [, edge] of graph.edges) {
        if (edge.fromNode === id && !visited.has(edge.toNode)) {
          stack.push(edge.toNode);
        }
        if (edge.toNode === id && !visited.has(edge.fromNode)) {
          stack.push(edge.fromNode);
        }
      }
    }
  }

  return component;
}

/**
 * Find shortest path between two nodes
 */
export function findShortestPath(
  graph: SkillGraph,
  sourceId: string,
  targetId: string
): SkillPath | null {
  const sourceNode = graph.nodes.get(sourceId);
  const targetNode = graph.nodes.get(targetId);

  if (!sourceNode || !targetNode) {
    return null;
  }

  const queue: [string, SkillNode[], number, number][] = [
    [sourceId, [sourceNode], 0, 1.0],
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const [nodeId, path, distance, strength] = queue.shift()!;

    if (nodeId === targetId) {
      return {
        source: sourceNode,
        target: targetNode,
        path,
        distance,
        strength,
      };
    }

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    // Find outgoing edges
    for (const [, edge] of graph.edges) {
      if (edge.fromNode === nodeId && !visited.has(edge.toNode)) {
        const nextNode = graph.nodes.get(edge.toNode);
        if (nextNode) {
          queue.push([
            edge.toNode,
            [...path, nextNode],
            distance + 1,
            strength * edge.strength,
          ]);
        }
      }
    }
  }

  return null;
}
