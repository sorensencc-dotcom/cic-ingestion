/**
 * GovernanceEvolutionEngine — auto-generates amendment/constraint/policy proposals
 * Uses Vault history + Memory signals to drive governance evolution
 */
import { VaultClient } from '../clients/VaultClient';
import { MemoryQueryClient } from '../clients/MemoryQueryClient';
import { GovernancePacket } from '../types/GovernancePacket';
export declare class GovernanceEvolutionEngine {
    private readonly vaultClient;
    private readonly memoryClient;
    constructor(vaultClient: VaultClient, memoryClient: MemoryQueryClient);
    /**
     * Generate amendment proposals based on drift signals
     */
    generateAmendments(): Promise<GovernancePacket[]>;
    /**
     * Generate constraint update proposals
     */
    generateConstraintUpdates(): Promise<GovernancePacket[]>;
    /**
     * Generate policy change proposals
     */
    generatePolicyChanges(): Promise<GovernancePacket[]>;
    /**
     * Run full evolution cycle
     */
    runFullCycle(): Promise<GovernancePacket[]>;
}
//# sourceMappingURL=GovernanceEvolutionEngine.d.ts.map