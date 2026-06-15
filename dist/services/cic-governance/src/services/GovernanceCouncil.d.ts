/**
 * GovernanceCouncil — orchestrates voting, decisions, and governance record-keeping
 *
 * Workflow:
 * 1. submitProposal() → creates proposal packet in Vault
 * 2. voteOnProposal() → creates vote packet, links to proposal
 * 3. finalizeDecision() → applies rules, creates decision packet
 * 4. getContext() → fetches proposal history + signals from Memory
 */
import { VaultClient } from '../clients/VaultClient';
import { MemoryQueryClient } from '../clients/MemoryQueryClient';
import { GovernancePacket } from '../types/GovernancePacket';
export interface NewProposal {
    authorId: string;
    payload: unknown;
    metadata?: GovernancePacket['metadata'];
}
export interface VoteInput {
    proposalId: string;
    voterId: string;
    vote: 'yes' | 'no' | 'abstain';
    payload?: unknown;
}
export interface GovernanceContext {
    proposal: GovernancePacket | null;
    history: GovernancePacket[];
    signals: unknown;
    stats: unknown;
}
export declare class GovernanceCouncil {
    private readonly vaultClient;
    private readonly memoryClient;
    constructor(vaultClient: VaultClient, memoryClient: MemoryQueryClient);
    /**
     * Submit a new proposal
     */
    submitProposal(input: NewProposal): Promise<GovernancePacket>;
    /**
     * Record a vote on a proposal
     */
    voteOnProposal(input: VoteInput): Promise<GovernancePacket>;
    /**
     * Finalize decision on proposal (majority vote)
     */
    finalizeDecision(proposalId: string): Promise<GovernancePacket>;
    /**
     * Get full context for a proposal (history + signals)
     */
    getContext(proposalId: string): Promise<GovernanceContext>;
}
//# sourceMappingURL=GovernanceCouncil.d.ts.map