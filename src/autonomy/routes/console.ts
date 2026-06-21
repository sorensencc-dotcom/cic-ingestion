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

import { Router, Request, Response } from 'express';
import { AutonomyService } from '../AutonomyService.js';
import { TorqueQueryClient } from '../../services/torquequery/TorqueQueryClient.js';
import { ObservabilityManager } from '../ObservabilityManager.js';
import {
  mapTorqueHealthToConsole,
  mapTorquePipelinesToConsole,
  mapTorqueAlertsToConsole,
  mapTorqueWorkspaceToConsole,
  mapTorqueAgentsToConsole,
  mapTorqueAgentDetailToConsole,
} from './mappers/consoleMappers.js';

export function createConsoleRouter(
  service: AutonomyService,
  torqueQuery: TorqueQueryClient,
): Router {
  const router = Router();
  const observability = ObservabilityManager.getInstance();

  /**
   * GET /console/health
   * Real-time system health from TorqueQuery
   */
  router.get('/console/health', async (req: Request, res: Response) => {
    try {
      const health = await torqueQuery.queryHealth();
      const mapped = mapTorqueHealthToConsole(health);

      return res.json({
        status: 'ok',
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('GET /console/health error:', err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'HEALTH_UNAVAILABLE',
          message: 'Failed to fetch system health',
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /console/pipelines
   * Active pipeline execution from TorqueQuery
   */
  router.get('/console/pipelines', async (req: Request, res: Response) => {
    try {
      const pipelines = await torqueQuery.queryPipelines();
      const mapped = mapTorquePipelinesToConsole(pipelines);

      return res.json({
        status: 'ok',
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('GET /console/pipelines error:', err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'PIPELINES_UNAVAILABLE',
          message: 'Failed to fetch pipeline data',
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /console/alerts
   * Active alerts from TorqueQuery
   */
  router.get('/console/alerts', async (req: Request, res: Response) => {
    try {
      const alerts = await torqueQuery.queryAlerts();
      const mapped = mapTorqueAlertsToConsole(alerts);

      return res.json({
        status: 'ok',
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('GET /console/alerts error:', err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'ALERTS_UNAVAILABLE',
          message: 'Failed to fetch alerts',
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /console/workspace
   * Workspace state from TorqueQuery (user, permissions, activity log)
   */
  router.get('/console/workspace', async (req: Request, res: Response) => {
    try {
      const workspace = await torqueQuery.queryWorkspace();
      const mapped = mapTorqueWorkspaceToConsole(workspace);

      return res.json({
        status: 'ok',
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('GET /console/workspace error:', err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'WORKSPACE_UNAVAILABLE',
          message: 'Failed to fetch workspace',
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /console/agents
   * Agent list from TorqueQuery
   */
  router.get('/console/agents', async (req: Request, res: Response) => {
    try {
      const agents = await torqueQuery.queryAgents();
      const mapped = mapTorqueAgentsToConsole(agents);

      return res.json({
        status: 'ok',
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('GET /console/agents error:', err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'AGENTS_UNAVAILABLE',
          message: 'Failed to fetch agents',
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /console/agents/:agentId
   * Agent detail from TorqueQuery
   */
  router.get('/console/agents/:agentId', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const agent = await torqueQuery.queryAgentDetail(agentId);
      const mapped = mapTorqueAgentDetailToConsole(agent);

      return res.json({
        status: 'ok',
        data: mapped,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`GET /console/agents/${req.params.agentId} error:`, err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'AGENT_DETAIL_UNAVAILABLE',
          message: `Failed to fetch agent ${req.params.agentId}`,
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /console/agents/:agentId/invoke
   * Invoke agent via TorqueQuery
   */
  router.post('/console/agents/:agentId/invoke', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const result = await torqueQuery.invokeAgent(agentId, req.body);

      return res.json({
        status: 'ok',
        data: { success: true, message: `Agent ${agentId} invoked` },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`POST /console/agents/${req.params.agentId}/invoke error:`, err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'AGENT_INVOKE_FAILED',
          message: `Failed to invoke agent ${req.params.agentId}`,
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /console/agents/:agentId/pause
   * Pause agent via TorqueQuery
   */
  router.post('/console/agents/:agentId/pause', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      await torqueQuery.pauseAgent(agentId);

      return res.json({
        status: 'ok',
        data: { success: true, message: `Agent ${agentId} paused` },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`POST /console/agents/${req.params.agentId}/pause error:`, err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'AGENT_PAUSE_FAILED',
          message: `Failed to pause agent ${req.params.agentId}`,
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /console/agents/:agentId/restart
   * Restart agent via TorqueQuery
   */
  router.post('/console/agents/:agentId/restart', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      await torqueQuery.restartAgent(agentId);

      return res.json({
        status: 'ok',
        data: { success: true, message: `Agent ${agentId} restarted` },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`POST /console/agents/${req.params.agentId}/restart error:`, err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'AGENT_RESTART_FAILED',
          message: `Failed to restart agent ${req.params.agentId}`,
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /console/agents/:agentId/snapshot
   * Snapshot agent state via TorqueQuery
   */
  router.post('/console/agents/:agentId/snapshot', async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const snapshot = await torqueQuery.snapshotAgent(agentId);

      return res.json({
        status: 'ok',
        data: { success: true, message: `Snapshot taken for ${agentId}`, snapshot },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(`POST /console/agents/${req.params.agentId}/snapshot error:`, err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'AGENT_SNAPSHOT_FAILED',
          message: `Failed to snapshot agent ${req.params.agentId}`,
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * POST /console/actions
   * Execute console actions (start-phase, pause, resume, reset)
   */
  router.post('/console/actions', async (req: Request, res: Response) => {
    try {
      const { action, debugMode, autoScale } = req.body;

      if (!action) {
        return res.status(400).json({
          status: 'error',
          error: {
            code: 'MISSING_ACTION',
            message: 'action field is required',
          },
          timestamp: new Date().toISOString(),
        });
      }

      const result = await torqueQuery.executeAction(action, { debugMode, autoScale });

      return res.json({
        status: 'ok',
        data: { success: true, message: result.message },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('POST /console/actions error:', err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'ACTION_FAILED',
          message: 'Failed to execute action',
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /console/metrics
   * System metrics from TorqueQuery
   */
  router.get('/console/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await torqueQuery.queryMetrics();

      return res.json({
        status: 'ok',
        data: {
          timestamp: new Date().toISOString(),
          cpuPercent: metrics.cpuPercent,
          memoryPercent: metrics.memoryPercent,
          diskPercent: metrics.diskPercent,
          networkIn: metrics.networkIn,
          networkOut: metrics.networkOut,
          requestsPerSecond: metrics.requestsPerSecond,
          errorRate: metrics.errorRate,
          avgLatencyMs: metrics.avgLatencyMs,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('GET /console/metrics error:', err);
      return res.status(502).json({
        status: 'error',
        error: {
          code: 'METRICS_UNAVAILABLE',
          message: 'Failed to fetch metrics',
          details: err?.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}
