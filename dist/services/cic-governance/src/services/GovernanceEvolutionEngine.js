/**
 * GovernanceEvolutionEngine — auto-generates amendment/constraint/policy proposals
 * Uses Vault history + Memory signals to drive governance evolution
 */
export class GovernanceEvolutionEngine {
    constructor(vaultClient, memoryClient) {
        this.vaultClient = vaultClient;
        this.memoryClient = memoryClient;
    }
    /**
     * Generate amendment proposals based on drift signals
     */
    async generateAmendments() {
        // Fetch drift metrics from Memory
        const driftSummary = await this.memoryClient.getSummaries('drift');
        // Fetch governance signals
        const signals = await this.memoryClient.getGovernanceSignals();
        // Create amendment proposal
        const packet = await this.vaultClient.write({
            kind: 'amendment',
            authorId: 'governance-evolution-engine',
            payload: {
                reason: 'auto-drift-response',
                drift_summary: driftSummary,
                signal_count: signals.length,
            },
            signals: signals.map((s) => s.id),
            metadata: { tags: ['auto-generated', 'drift-response'] },
        });
        return [packet];
    }
    /**
     * Generate constraint update proposals
     */
    async generateConstraintUpdates() {
        // Fetch recent events for constraint analysis
        const recentEvents = await this.memoryClient.getRecentEvents(7);
        // Analyze for constraint violations (simplified)
        const violations = recentEvents.filter((e) => e.payload.status === 'failed');
        if (violations.length === 0) {
            return [];
        }
        const packet = await this.vaultClient.write({
            kind: 'amendment',
            authorId: 'governance-evolution-engine',
            payload: {
                reason: 'constraint-violation-response',
                violation_count: violations.length,
                suggested_constraints: ['add-retry-logic', 'increase-timeout'],
            },
            signals: violations.map((v) => v.id),
            metadata: { tags: ['auto-generated', 'constraint-update'] },
        });
        return [packet];
    }
    /**
     * Generate policy change proposals
     */
    async generatePolicyChanges() {
        // Fetch health metrics
        const healthSummary = await this.memoryClient.getSummaries('health');
        // Fetch decision history
        const recentEvents = await this.memoryClient.getRecentEvents(14);
        const decisions = recentEvents.filter((e) => e.event_type === 'GOVERNANCE_SIGNAL');
        if (decisions.length === 0) {
            return [];
        }
        const packet = await this.vaultClient.write({
            kind: 'amendment',
            authorId: 'governance-evolution-engine',
            payload: {
                reason: 'health-based-policy-evolution',
                health_summary: healthSummary,
                decision_count: decisions.length,
                suggested_policies: ['increase-autonomy-threshold', 'reduce-escalation-delay'],
            },
            signals: decisions.map((d) => d.id),
            metadata: { tags: ['auto-generated', 'policy-update'] },
        });
        return [packet];
    }
    /**
     * Run full evolution cycle
     */
    async runFullCycle() {
        const amendments = await this.generateAmendments();
        const constraints = await this.generateConstraintUpdates();
        const policies = await this.generatePolicyChanges();
        return [...amendments, ...constraints, ...policies];
    }
}
//# sourceMappingURL=GovernanceEvolutionEngine.js.map