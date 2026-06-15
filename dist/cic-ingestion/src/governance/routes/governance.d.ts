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
export declare function createGovernanceRouter(): Router;
//# sourceMappingURL=governance.d.ts.map