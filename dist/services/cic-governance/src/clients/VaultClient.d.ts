/**
 * VaultClient — HTTP client for Vault (Phase 24 M3 endpoint)
 * Handles deterministic digest computation and CRUD
 */
import { GovernancePacket } from '../types/GovernancePacket';
export declare class VaultClient {
    private http;
    constructor(baseUrl?: string);
    private sha256;
    /**
     * Write packet to Vault with computed digest
     */
    write(packet: Omit<GovernancePacket, 'vaultDigest' | 'id' | 'createdAt'>): Promise<GovernancePacket>;
    /**
     * Query packets by proposal ID
     */
    listByProposal(proposalId: string): Promise<GovernancePacket[]>;
    /**
     * Get single packet by ID
     */
    get(id: string): Promise<GovernancePacket | null>;
}
//# sourceMappingURL=VaultClient.d.ts.map