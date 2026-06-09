/**
 * Autonomy Proposals Routes (Phase 23.7.3)
 * GET /autonomy/proposals — query proposals
 * POST /autonomy/proposals — generate proposals from signals
 * PUT /autonomy/proposals/:id — update proposal status
 */
import { Router } from 'express';
import { AutonomyService } from '../AutonomyService';
export declare function createProposalsRouter(service: AutonomyService): Router;
//# sourceMappingURL=proposals.d.ts.map