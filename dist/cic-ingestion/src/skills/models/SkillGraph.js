/**
 * Skill Graph Models (Phase 24.1)
 * Nodes: skills, instincts, hooks, rules, agents
 * Edges: depends_on, enhances, conflicts_with
 */
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
};
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
};
/**
 * Create a new skill node
 */
export function createSkillNode(id, type, name, description, category) {
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
export function createSkillEdge(id, fromNode, toNode, type, strength = 0.8) {
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
export function calculateGraphDensity(graph) {
    const nodes = graph.nodes.size;
    if (nodes <= 1)
        return 0;
    const maxEdges = nodes * (nodes - 1); // directed graph
    const actualEdges = graph.edges.size;
    return actualEdges / maxEdges;
}
/**
 * Find connected components in skill graph
 */
export function findConnectedComponents(graph) {
    const visited = new Set();
    const components = [];
    for (const nodeId of graph.nodes.keys()) {
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
function dfsComponent(nodeId, graph, visited) {
    const component = [];
    const stack = [nodeId];
    while (stack.length > 0) {
        const id = stack.pop();
        if (visited.has(id))
            continue;
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
export function findShortestPath(graph, sourceId, targetId) {
    const sourceNode = graph.nodes.get(sourceId);
    const targetNode = graph.nodes.get(targetId);
    if (!sourceNode || !targetNode) {
        return null;
    }
    const queue = [
        [sourceId, [sourceNode], 0, 1.0],
    ];
    const visited = new Set();
    while (queue.length > 0) {
        const [nodeId, path, distance, strength] = queue.shift();
        if (nodeId === targetId) {
            return {
                source: sourceNode,
                target: targetNode,
                path,
                distance,
                strength,
            };
        }
        if (visited.has(nodeId))
            continue;
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
//# sourceMappingURL=SkillGraph.js.map