/**
 * Test Fixtures for Bridge Tests
 * Mock signal and proposal generators
 */
/**
 * Create mock drift signal
 */
export function createMockDriftSignal(severity = 'warning') {
    return {
        id: `drift_${Date.now()}`,
        type: 'drift',
        severity,
        confidence: severity === 'critical' ? 0.85 : 0.65,
        affectedPhases: ['Phase 24', 'Phase 25'],
        evidence: [createMockTimelineEvent()],
        timestamp: new Date().toISOString(),
        description: 'Detected drift in phase execution patterns',
        recommendation: 'Review ARPS state and APR goals',
        driftMetrics: {
            semantic_drift: 0.72,
            temporal_drift: 0.68,
            narrative_drift: 0.75,
            causal_drift: 0.70,
            combined_score: 0.71,
        },
        metadata: {
            window: '7d',
            metric_count: 10,
        },
    };
}
/**
 * Create mock instability signal
 */
export function createMockInstabilitySignal(severity = 'warning') {
    return {
        id: `instability_${Date.now()}`,
        type: 'instability',
        severity,
        confidence: severity === 'critical' ? 0.8 : 0.7,
        affectedPhases: ['Phase 25', 'Phase 26'],
        evidence: [createMockTimelineEvent()],
        timestamp: new Date().toISOString(),
        description: 'High error rate detected in runtime metrics',
        recommendation: 'Allocate resources and increase testing',
        instabilityMetrics: {
            error_rate: 0.18,
            failure_rate: 0.08,
            latency_variance: 250,
            throughput_variance: 0.15,
        },
        metadata: {
            window: '24h',
            metric_count: 5,
        },
    };
}
/**
 * Create mock regression signal
 */
export function createMockRegressionSignal(severity = 'warning') {
    return {
        id: `regression_${Date.now()}`,
        type: 'regression',
        severity,
        confidence: severity === 'critical' ? 0.9 : 0.75,
        affectedPhases: ['Phase 26', 'Phase 27'],
        evidence: [createMockTimelineEvent()],
        timestamp: new Date().toISOString(),
        description: 'Latency increased by 2.5x vs baseline',
        recommendation: 'Root cause analysis and performance optimization',
        regressionMetrics: {
            baseline_latency: 200,
            current_latency: 500,
            latency_increase_factor: 2.5,
            baseline_success_rate: 0.95,
            current_success_rate: 0.88,
            success_rate_decline: 0.07,
        },
        metadata: {
            window: '7d',
            metric_count: 7,
        },
    };
}
/**
 * Create mock opportunity signal
 */
export function createMockOpportunitySignal() {
    return {
        id: `opportunity_${Date.now()}`,
        type: 'opportunity',
        severity: 'info',
        confidence: 0.92,
        affectedPhases: ['Phase 24'],
        evidence: [createMockTimelineEvent()],
        timestamp: new Date().toISOString(),
        description: 'Consistently high success rate presents acceleration opportunity',
        recommendation: 'Consider accelerating dependent phases',
        opportunityMetrics: {
            success_rate: 0.97,
            consistency: 0.94,
            potential_improvement: 'Accelerate Phase 25–27',
        },
        metadata: {
            window: '7d',
            metric_count: 7,
        },
    };
}
/**
 * Create mock timeline event
 */
export function createMockTimelineEvent(type = 'PIPELINE_RUN') {
    return {
        id: `event_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toISOString(),
        type,
        correlationId: `corr_${Date.now()}`,
        summary: `Sample ${type} event`,
        severity: 'info',
        metadata: {
            phase: 'Phase 24',
            duration: 150,
        },
    };
}
/**
 * Create mock proposal
 */
export function createMockProposal(status = 'pending') {
    return {
        id: `proposal_Phase24_${Date.now()}`,
        timestamp: new Date().toISOString(),
        triggeredBy: [createMockDriftSignal('critical')],
        actions: [
            {
                type: 'defer_phase',
                phase: 'Phase 24',
                description: 'Defer Phase 24 to investigate drift',
                newTargetDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
                estimatedDurationChange: 72, // 3 days
            },
        ],
        impact: {
            affectedPhases: ['Phase 24', 'Phase 25', 'Phase 26'],
            estimatedDurationChange: 72,
            riskLevel: 'medium',
            dependencies: ['Phase 23'],
            rationale: 'Critical drift signal requires investigation before proceeding',
        },
        confidence: 0.85,
        status,
        approvalStatus: status === 'pending'
            ? {
                requestedAt: new Date().toISOString(),
                votesRequired: 3,
                votesReceived: 0,
            }
            : undefined,
        metadata: {
            signal_count: 1,
            critical_signals: 1,
            warning_signals: 0,
        },
    };
}
/**
 * Create mock proposal with multiple actions
 */
export function createMockProposalWithMultipleActions() {
    const proposal = createMockProposal('pending');
    proposal.actions.push({
        type: 'allocate_resources',
        phase: 'Phase 25',
        description: 'Allocate additional engineers for stabilization',
        resourceRequirements: { engineers: 2, hours_per_week: 40 },
        estimatedDurationChange: -8,
    }, {
        type: 'reprioritize',
        phase: 'Phase 26',
        description: 'Deprioritize Phase 26 to focus on Phase 24 issues',
        newPosition: 5,
    });
    return proposal;
}
/**
 * Create mock approved proposal
 */
export function createMockApprovedProposal() {
    const proposal = createMockProposal('approved');
    proposal.approvalStatus = {
        requestedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        votesRequired: 3,
        votesReceived: 3,
        councilVotes: [
            {
                voterId: 'council_member_1',
                decision: 'approve',
                reason: 'Drift signal is legitimate',
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                voterId: 'council_member_2',
                decision: 'approve',
                reason: 'Mitigation plan is sound',
                timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            },
            {
                voterId: 'council_member_3',
                decision: 'approve',
                reason: 'Agreed',
                timestamp: new Date().toISOString(),
            },
        ],
    };
    return proposal;
}
/**
 * Create multiple mock signals
 */
export function createMockSignals(count = 3) {
    const signals = [];
    for (let i = 0; i < count; i++) {
        const type = ['drift', 'instability', 'regression', 'opportunity'][i % 4];
        switch (type) {
            case 'drift':
                signals.push(createMockDriftSignal(i % 2 === 0 ? 'critical' : 'warning'));
                break;
            case 'instability':
                signals.push(createMockInstabilitySignal('warning'));
                break;
            case 'regression':
                signals.push(createMockRegressionSignal('critical'));
                break;
            case 'opportunity':
                signals.push(createMockOpportunitySignal());
                break;
        }
    }
    return signals;
}
/**
 * Create multiple mock proposals
 */
export function createMockProposals(count = 2) {
    const proposals = [];
    for (let i = 0; i < count; i++) {
        const status = i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'approved' : 'rejected';
        proposals.push(createMockProposal(status));
    }
    return proposals;
}
//# sourceMappingURL=fixtures.js.map