/**
 * Roadmap proposal types and data models (Phase 23.7)
 * Proposals generated from autonomy signals to adjust CIC roadmap
 */
/**
 * Proposal priority scoring based on signals and impact
 */
export function scoreProposalPriority(proposal) {
    let score = 0;
    // Signal severity contributes to priority
    for (const signal of proposal.triggeredBy) {
        switch (signal.severity) {
            case 'critical':
                score += 10;
                break;
            case 'warning':
                score += 5;
                break;
            case 'info':
                score += 1;
                break;
        }
        score *= signal.confidence;
    }
    // Risk level affects priority
    switch (proposal.impact.riskLevel) {
        case 'low':
            score *= 1.2;
            break;
        case 'medium':
            score *= 1.0;
            break;
        case 'high':
            score *= 0.8;
            break;
    }
    return Math.min(score, 100); // Cap at 100
}
/**
 * Check if proposal requires governance approval
 */
export function requiresGovernanceApproval(proposal) {
    const priority = scoreProposalPriority(proposal);
    // High-risk or high-priority proposals need approval
    return (proposal.impact.riskLevel === 'high' ||
        priority > 50 ||
        proposal.triggeredBy.some((sig) => sig.severity === 'critical'));
}
/**
 * Estimate roadmap completion date after proposal execution
 */
export function estimateCompletionAfterProposal(baseCompletionDate, proposal) {
    const durationChangeMs = proposal.impact.estimatedDurationChange * 3600000; // hours to ms
    return new Date(baseCompletionDate.getTime() + durationChangeMs);
}
//# sourceMappingURL=RoadmapProposal.js.map
