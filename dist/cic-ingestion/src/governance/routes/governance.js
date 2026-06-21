/**
 * Governance Routes (Phase 24)
 * Exposes GovernanceCouncil and GovernanceEvolutionEngine via HTTP
 *
 * Routes:
 * - POST /proposals — submit proposal
 * - POST /votes — vote on proposal
 * - POST /decisions/:proposalId/finalize — finalize decision
 * - GET /context/:proposalId — fetch proposal context
 * - POST /evolution/amendments — generate amendments
 * - POST /evolution/constraints — generate constraint updates
 * - POST /evolution/policies — generate policy changes
 * - POST /evolution/full-cycle — run full evolution cycle
 */
import { Router } from 'express';
import { GovernanceCouncil } from '../../../../services/cic-governance/src/services/GovernanceCouncil.js';
import { GovernanceEvolutionEngine } from '../../../../services/cic-governance/src/services/GovernanceEvolutionEngine.js';
import { VaultClient } from '../../../../services/cic-governance/src/clients/VaultClient.js';
import { MemoryQueryClient } from '../../../../services/cic-governance/src/clients/MemoryQueryClient.js';
export function createGovernanceRouter() {
    const router = Router();
    // Initialize clients
    const vaultClient = new VaultClient(process.env.VAULT_BASE_URL || 'http://localhost:3000');
    const memoryClient = new MemoryQueryClient(process.env.MEMORY_BASE_URL || 'http://localhost:3000');
    // Initialize services
    const council = new GovernanceCouncil(vaultClient, memoryClient);
    const evolution = new GovernanceEvolutionEngine(vaultClient, memoryClient);
    /**
     * POST /governance/proposals
     * Submit a new proposal
     *
     * Body: { authorId: string, payload: unknown, metadata?: {...} }
     * Response: GovernancePacket
     */
    router.post('/proposals', async (req, res, next) => {
        try {
            const packet = await council.submitProposal(req.body);
            res.status(201).json(packet);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * POST /governance/votes
     * Record a vote on a proposal
     *
     * Body: { proposalId: string, voterId: string, vote: 'yes'|'no'|'abstain', payload?: {...} }
     * Response: GovernancePacket
     */
    router.post('/votes', async (req, res, next) => {
        try {
            const packet = await council.voteOnProposal(req.body);
            res.status(201).json(packet);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * POST /governance/decisions/:proposalId/finalize
     * Finalize decision on proposal (apply voting rules)
     *
     * Response: GovernancePacket (decision)
     */
    router.post('/decisions/:proposalId/finalize', async (req, res, next) => {
        try {
            const { proposalId } = req.params;
            const packet = await council.finalizeDecision(proposalId);
            res.json(packet);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * GET /governance/context/:proposalId
     * Fetch full context for proposal (history + signals)
     *
     * Response: { proposal, history, signals, stats }
     */
    router.get('/context/:proposalId', async (req, res, next) => {
        try {
            const { proposalId } = req.params;
            const ctx = await council.getContext(proposalId);
            res.json(ctx);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * POST /governance/evolution/amendments
     * Generate amendment proposals from drift signals
     *
     * Response: GovernancePacket[]
     */
    router.post('/evolution/amendments', async (_req, res, next) => {
        try {
            const packets = await evolution.generateAmendments();
            res.status(201).json(packets);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * POST /governance/evolution/constraints
     * Generate constraint update proposals
     *
     * Response: GovernancePacket[]
     */
    router.post('/evolution/constraints', async (_req, res, next) => {
        try {
            const packets = await evolution.generateConstraintUpdates();
            res.status(201).json(packets);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * POST /governance/evolution/policies
     * Generate policy change proposals
     *
     * Response: GovernancePacket[]
     */
    router.post('/evolution/policies', async (_req, res, next) => {
        try {
            const packets = await evolution.generatePolicyChanges();
            res.status(201).json(packets);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * POST /governance/evolution/full-cycle
     * Run full evolution cycle (amendments + constraints + policies)
     *
     * Response: GovernancePacket[]
     */
    router.post('/evolution/full-cycle', async (_req, res, next) => {
        try {
            const packets = await evolution.runFullCycle();
            res.status(201).json(packets);
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
//# sourceMappingURL=governance.js.map
