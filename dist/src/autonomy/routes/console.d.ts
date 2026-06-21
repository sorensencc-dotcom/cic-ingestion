/**
 * Console v3 Routes (Phase 2: TorqueQuery Integration)
 * Serves real-time data to operator dashboard from TorqueQuery backend
 *
 * Endpoints:
 *   GET /console/health
 *   GET /console/pipelines
 *   GET /console/alerts
 *   GET /console/workspace
 *   GET /console/agents
 *   GET /console/agents/:agentId
 *   POST /console/agents/:agentId/invoke
 *   POST /console/agents/:agentId/pause
 *   POST /console/agents/:agentId/restart
 *   POST /console/agents/:agentId/snapshot
 *   POST /console/actions
 *   GET /console/metrics
 */
import { Router } from 'express';
import { AutonomyService } from '../AutonomyService.js';
import { TorqueQueryClient } from '../../services/torquequery/TorqueQueryClient.js';
export declare function createConsoleRouter(service: AutonomyService, torqueQuery: TorqueQueryClient): Router;
//# sourceMappingURL=console.d.ts.map