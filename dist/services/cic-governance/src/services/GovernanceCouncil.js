/**
 * GovernanceCouncil — orchestrates voting, decisions, and governance record-keeping
 *
 * Workflow:
 * 1. submitProposal() → creates proposal packet in Vault
 * 2. voteOnProposal() → creates vote packet, links to proposal
 * 3. finalizeDecision() → applies rules, creates decision packet
 * 4. getContext() → fetches proposal history + signals from Memory
 */
export class GovernanceCouncil {
    constructor(vaultClient, memoryClient) {
        this.vaultClient = vaultClient;
        this.memoryClient = memoryClient;
    }
    /**
     * Submit a new proposal
     */
    async submitProposal(input) {
        return this.vaultClient.write({
            kind: 'proposal',
            authorId: input.authorId,
            payload: input.payload,
            signals: [],
            metadata: input.metadata ?? {},
        });
    }
    /**
     * Record a vote on a proposal
     */
    async voteOnProposal(input) {
        return this.vaultClient.write({
            kind: 'vote',
            proposalId: input.proposalId,
            authorId: input.voterId,
            payload: {
                vote: input.vote,
                ...input.payload,
            },
            signals: [],
            metadata: {},
        });
    }
    /**
     * Finalize decision on proposal (majority vote)
     */
    async finalizeDecision(proposalId) {
        const history = await this.vaultClient.listByProposal(proposalId);
        // Count votes
        const votes = history.filter((h) => h.kind === 'vote');
        const yesVotes = votes.filter((v) => v.payload.vote === 'yes').length;
        const noVotes = votes.filter((v) => v.payload.vote === 'no').length;
        const totalVotes = yesVotes + noVotes;
        // Simple majority
        const approved = yesVotes > noVotes;
        const decisionPayload = {
            totalVotes,
            yesVotes,
            noVotes,
            approved,
            decision: approved ? 'APPROVED' : 'REJECTED',
        };
        return this.vaultClient.write({
            kind: 'decision',
            proposalId,
            authorId: 'governance-council',
            payload: decisionPayload,
            signals: [],
            metadata: { ruleSet: 'majority-v1' },
        });
    }
    /**
     * Get full context for a proposal (history + signals)
     */
    async getContext(proposalId) {
        const history = await this.vaultClient.listByProposal(proposalId);
        const proposal = history.find((h) => h.kind === 'proposal') ?? null;
        const signals = await this.memoryClient.getEventsByProposal(proposalId);
        const stats = await this.memoryClient.getStats();
        return { proposal, history, signals, stats };
    }
}
//# sourceMappingURL=GovernanceCouncil.js.map