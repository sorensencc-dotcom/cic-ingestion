/**
 * Skill Graph Store (Phase 24.2)
 * Persistent capability graph with versioning and history
 */
import { calculateGraphDensity, findConnectedComponents, } from './models/SkillGraph.js';
/**
 * In-memory skill graph store with versioning
 */
export class SkillGraphStore {
    constructor() {
        this.history = new Map();
        this.currentGraph = {
            id: `graph_${Date.now()}`,
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            nodes: new Map(),
            edges: new Map(),
            metadata: {
                totalNodes: 0,
                totalEdges: 0,
                byType: {
                    skill: 0,
                    instinct: 0,
                    hook: 0,
                    rule: 0,
                    agent: 0,
                },
                lastUpdatedAt: new Date().toISOString(),
            },
        };
        // Store initial version
        this.saveVersion('1.0.0', ['Initial version']);
    }
    /**
     * Add a skill node to the graph
     */
    addNode(node) {
        this.currentGraph.nodes.set(node.id, node);
        this.currentGraph.metadata.totalNodes++;
        this.currentGraph.metadata.byType[node.type]++;
        this.currentGraph.metadata.lastUpdatedAt = new Date().toISOString();
    }
    /**
     * Update a skill node
     */
    updateNode(nodeId, updates) {
        const node = this.currentGraph.nodes.get(nodeId);
        if (node) {
            Object.assign(node, updates);
            node.metadata.lastUpdated = new Date().toISOString();
            this.currentGraph.metadata.lastUpdatedAt = new Date().toISOString();
        }
    }
    /**
     * Remove a skill node (and associated edges)
     */
    removeNode(nodeId) {
        const node = this.currentGraph.nodes.get(nodeId);
        if (node) {
            this.currentGraph.nodes.delete(nodeId);
            this.currentGraph.metadata.totalNodes--;
            this.currentGraph.metadata.byType[node.type]--;
            // Remove associated edges
            const edgesToRemove = [];
            for (const [edgeId, edge] of this.currentGraph.edges) {
                if (edge.fromNode === nodeId || edge.toNode === nodeId) {
                    edgesToRemove.push(edgeId);
                }
            }
            for (const edgeId of edgesToRemove) {
                this.removeEdge(edgeId);
            }
            this.currentGraph.metadata.lastUpdatedAt = new Date().toISOString();
        }
    }
    /**
     * Get a skill node by ID
     */
    getNode(nodeId) {
        return this.currentGraph.nodes.get(nodeId);
    }
    /**
     * Get all nodes of a specific type
     */
    getNodesByType(type) {
        const nodes = [];
        for (const [, node] of this.currentGraph.nodes) {
            if (node.type === type) {
                nodes.push(node);
            }
        }
        return nodes;
    }
    /**
     * Add a skill edge to the graph
     */
    addEdge(edge) {
        // Validate nodes exist
        if (!this.currentGraph.nodes.has(edge.fromNode)) {
            throw new Error(`Node not found: ${edge.fromNode}`);
        }
        if (!this.currentGraph.nodes.has(edge.toNode)) {
            throw new Error(`Node not found: ${edge.toNode}`);
        }
        this.currentGraph.edges.set(edge.id, edge);
        this.currentGraph.metadata.totalEdges++;
        this.currentGraph.metadata.lastUpdatedAt = new Date().toISOString();
    }
    /**
     * Remove a skill edge
     */
    removeEdge(edgeId) {
        if (this.currentGraph.edges.has(edgeId)) {
            this.currentGraph.edges.delete(edgeId);
            this.currentGraph.metadata.totalEdges--;
            this.currentGraph.metadata.lastUpdatedAt = new Date().toISOString();
        }
    }
    /**
     * Get edges for a specific node (incoming and outgoing)
     */
    getNodeEdges(nodeId) {
        const incoming = [];
        const outgoing = [];
        for (const [, edge] of this.currentGraph.edges) {
            if (edge.fromNode === nodeId) {
                outgoing.push(edge);
            }
            if (edge.toNode === nodeId) {
                incoming.push(edge);
            }
        }
        return { incoming, outgoing };
    }
    /**
     * Get current graph
     */
    getGraph() {
        return this.currentGraph;
    }
    /**
     * Get graph statistics
     */
    getStats() {
        const components = findConnectedComponents(this.currentGraph);
        return {
            totalNodes: this.currentGraph.metadata.totalNodes,
            totalEdges: this.currentGraph.metadata.totalEdges,
            density: calculateGraphDensity(this.currentGraph),
            components: components.length,
            largestComponent: Math.max(...components.map((c) => c.length), 0),
            byType: this.currentGraph.metadata.byType,
            lastUpdated: this.currentGraph.metadata.lastUpdatedAt,
        };
    }
    /**
     * Save current graph as a new version
     */
    saveVersion(version, changes) {
        // Deep clone the graph
        const graphClone = {
            ...this.currentGraph,
            nodes: new Map(this.currentGraph.nodes),
            edges: new Map(this.currentGraph.edges),
            metadata: { ...this.currentGraph.metadata },
        };
        const versionRecord = {
            version,
            timestamp: new Date().toISOString(),
            changes,
            graph: graphClone,
        };
        this.history.set(version, versionRecord);
        this.currentGraph.version = version;
    }
    /**
     * Get a specific version
     */
    getVersion(version) {
        return this.history.get(version);
    }
    /**
     * Get version history
     */
    getVersionHistory() {
        return Array.from(this.history.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    /**
     * Rollback to a previous version
     */
    rollbackToVersion(version) {
        const versionRecord = this.history.get(version);
        if (!versionRecord) {
            throw new Error(`Version not found: ${version}`);
        }
        // Deep clone from history
        this.currentGraph = {
            ...versionRecord.graph,
            nodes: new Map(versionRecord.graph.nodes),
            edges: new Map(versionRecord.graph.edges),
            metadata: { ...versionRecord.graph.metadata },
        };
    }
    /**
     * Find skills that match a capability query
     */
    findCapabilities(query) {
        const results = [];
        for (const [, node] of this.currentGraph.nodes) {
            if (query.category && node.category !== query.category)
                continue;
            if (query.type && node.type !== query.type)
                continue;
            if (query.status && node.status !== query.status)
                continue;
            results.push(node);
        }
        return results;
    }
    /**
     * Detect capability gaps
     */
    detectGaps(requiredCapabilities) {
        const gaps = [];
        for (const capability of requiredCapabilities) {
            const found = Array.from(this.currentGraph.nodes.values()).some((node) => node.capabilities?.includes(capability) ||
                node.name.toLowerCase().includes(capability.toLowerCase()));
            if (!found) {
                gaps.push(capability);
            }
        }
        return gaps;
    }
    /**
     * Calculate capability coverage
     */
    calculateCapabilityCoverage(requiredCapabilities) {
        if (requiredCapabilities.length === 0)
            return 1.0;
        const gaps = this.detectGaps(requiredCapabilities);
        return (requiredCapabilities.length - gaps.length) / requiredCapabilities.length;
    }
    /**
     * Create capability set snapshot
     */
    createCapabilitySet(name) {
        const gaps = this.detectGaps([]);
        const allNodes = Array.from(this.currentGraph.nodes.values());
        return {
            id: `capset_${Date.now()}`,
            name,
            skills: allNodes,
            coverage: this.calculateCapabilityCoverage(allNodes.flatMap((n) => n.capabilities || [])),
            gaps,
            redundancies: this.detectRedundancies(),
            timestamp: new Date().toISOString(),
        };
    }
    /**
     * Detect redundant skills (same capability, multiple implementations)
     */
    detectRedundancies() {
        const capabilityMap = {};
        for (const [, node] of this.currentGraph.nodes) {
            for (const cap of node.capabilities || []) {
                if (!capabilityMap[cap]) {
                    capabilityMap[cap] = [];
                }
                capabilityMap[cap].push(node.id);
            }
        }
        const redundancies = [];
        for (const [cap, nodeIds] of Object.entries(capabilityMap)) {
            if (nodeIds.length > 1) {
                redundancies.push(`${cap} (${nodeIds.length} implementations)`);
            }
        }
        return redundancies;
    }
    /**
     * Calculate drift score (capability vs expected)
     */
    calculateDrift(expectedCapabilities) {
        let drift = 0;
        let totalExpected = 0;
        for (const [capability, importance] of Object.entries(expectedCapabilities)) {
            totalExpected += importance;
            const found = Array.from(this.currentGraph.nodes.values()).find((node) => node.capabilities?.includes(capability) ||
                node.name.toLowerCase().includes(capability.toLowerCase()));
            if (!found || !found.capabilities?.includes(capability)) {
                drift += importance;
            }
        }
        return totalExpected > 0 ? drift / totalExpected : 0;
    }
    /**
     * Clear all data (for testing)
     */
    clear() {
        this.currentGraph.nodes.clear();
        this.currentGraph.edges.clear();
        this.history.clear();
        this.currentGraph.metadata.totalNodes = 0;
        this.currentGraph.metadata.totalEdges = 0;
    }
}
//# sourceMappingURL=SkillGraphStore.js.map