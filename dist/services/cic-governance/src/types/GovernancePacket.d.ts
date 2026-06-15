/**
 * GovernancePacket — immutable record of governance action
 * Stored in Vault, keyed by proposal ID
 *
 * Types: proposal | vote | decision | amendment
 */
export type GovernanceKind = 'proposal' | 'vote' | 'decision' | 'amendment';
export interface GovernancePacket {
    id: string;
    kind: GovernanceKind;
    proposalId?: string;
    authorId: string;
    payload: unknown;
    createdAt: string;
    vaultDigest: string;
    signals: string[];
    metadata: {
        quorum?: number;
        ruleSet?: string;
        version?: string;
        tags?: string[];
    };
}
//# sourceMappingURL=GovernancePacket.d.ts.map