import express, { Express } from 'express';
import { Server } from 'http';
import { createConsoleRouter } from '../console';
import { TorqueQueryClient } from '../../../services/torquequery/TorqueQueryClient';
import { AdapterIntegrationService } from '../../../services/AdapterIntegrationService';

jest.mock('../../../services/torquequery/TorqueQueryClient');
jest.mock('../../../services/AdapterIntegrationService');

describe('Console Router', () => {
  let app: Express;
  let server: Server;
  let baseUrl: string;

  let mockTorqueQuery: jest.Mocked<TorqueQueryClient>;
  let mockAdapterService: jest.Mocked<AdapterIntegrationService>;
  let consoleSpy: jest.SpyInstance;

  beforeAll((done) => {
    mockTorqueQuery = {
      queryHealth: jest.fn(),
      queryPipelines: jest.fn(),
      queryAlerts: jest.fn(),
      queryWorkspace: jest.fn(),
      queryAgents: jest.fn(),
      queryAgentDetail: jest.fn(),
      invokeAgent: jest.fn(),
      pauseAgent: jest.fn(),
      restartAgent: jest.fn(),
      snapshotAgent: jest.fn(),
      executeAction: jest.fn(),
    } as any;

    mockAdapterService = {
      execute: jest.fn(),
    } as any;

    app = express();
    app.use(express.json());
    app.use(createConsoleRouter(mockTorqueQuery, mockAdapterService));

    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('GET /console/health', () => {
    it('should return mapped health data on success', async () => {
      mockTorqueQuery.queryHealth.mockResolvedValue({
        status: 'healthy',
        services: [{ name: 's1', status: 'ok' }],
      } as any);

      const response = await fetch(`${baseUrl}/console/health`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.status).toBe('ok');
      expect(body.data.status).toBe('green');
    });

    it('should return 502 error response when TorqueQuery fails', async () => {
      mockTorqueQuery.queryHealth.mockRejectedValue(new Error('Connection failed'));

      const response = await fetch(`${baseUrl}/console/health`);
      expect(response.status).toBe(502);
      const body = (await response.json()) as any;
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('HEALTH_UNAVAILABLE');
    });
  });

  describe('GET /console/pipelines', () => {
    it('should return mapped pipelines on success', async () => {
      mockTorqueQuery.queryPipelines.mockResolvedValue({
        pipelines: [{ id: 'p1', name: 'Pipeline 1', state: 'running' }],
      } as any);

      const response = await fetch(`${baseUrl}/console/pipelines`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.status).toBe('ok');
      expect(body.data[0].id).toBe('p1');
    });

    it('should return 502 when queryPipelines fails', async () => {
      mockTorqueQuery.queryPipelines.mockRejectedValue(new Error('Backend error'));

      const response = await fetch(`${baseUrl}/console/pipelines`);
      expect(response.status).toBe(502);
      const body = (await response.json()) as any;
      expect(body.error.code).toBe('PIPELINES_UNAVAILABLE');
    });
  });

  describe('GET /console/alerts', () => {
    it('should return mapped alerts on success', async () => {
      mockTorqueQuery.queryAlerts.mockResolvedValue({
        alerts: [{ id: 'a1', severity: 'warning', message: 'High CPU' }],
      } as any);

      const response = await fetch(`${baseUrl}/console/alerts`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.status).toBe('ok');
      expect(body.data[0].id).toBe('a1');
    });

    it('should return 502 on failure', async () => {
      mockTorqueQuery.queryAlerts.mockRejectedValue(new Error('Alert query failed'));

      const response = await fetch(`${baseUrl}/console/alerts`);
      expect(response.status).toBe(502);
      const body = (await response.json()) as any;
      expect(body.error.code).toBe('ALERTS_UNAVAILABLE');
    });
  });

  describe('GET /console/workspace', () => {
    it('should return mapped workspace state', async () => {
      mockTorqueQuery.queryWorkspace.mockResolvedValue({
        userId: 'u1',
        userName: 'Dev',
      } as any);

      const response = await fetch(`${baseUrl}/console/workspace`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.data.user.id).toBe('u1');
    });

    it('should return 502 on workspace query failure', async () => {
      mockTorqueQuery.queryWorkspace.mockRejectedValue(new Error('Workspace error'));

      const response = await fetch(`${baseUrl}/console/workspace`);
      expect(response.status).toBe(502);
      const body = (await response.json()) as any;
      expect(body.error.code).toBe('WORKSPACE_UNAVAILABLE');
    });
  });

  describe('GET /console/agents and /console/agents/:agentId', () => {
    it('should return mapped agents list', async () => {
      mockTorqueQuery.queryAgents.mockResolvedValue({
        agents: [{ id: 'ag1', name: 'Agent 1', status: 'online' }],
      } as any);

      const response = await fetch(`${baseUrl}/console/agents`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.data[0].id).toBe('ag1');
    });

    it('should return 502 when queryAgents fails', async () => {
      mockTorqueQuery.queryAgents.mockRejectedValue(new Error('Agents error'));

      const response = await fetch(`${baseUrl}/console/agents`);
      expect(response.status).toBe(502);
      const body = (await response.json()) as any;
      expect(body.error.code).toBe('AGENTS_UNAVAILABLE');
    });

    it('should return mapped agent detail by ID', async () => {
      mockTorqueQuery.queryAgentDetail.mockResolvedValue({
        id: 'ag-99',
        name: 'Special Agent',
      } as any);

      const response = await fetch(`${baseUrl}/console/agents/ag-99`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.data.id).toBe('ag-99');
    });

    it('should return 502 when queryAgentDetail fails', async () => {
      mockTorqueQuery.queryAgentDetail.mockRejectedValue(new Error('Not found'));

      const response = await fetch(`${baseUrl}/console/agents/ag-99`);
      expect(response.status).toBe(502);
      const body = (await response.json()) as any;
      expect(body.error.code).toBe('AGENT_DETAIL_UNAVAILABLE');
    });
  });

  describe('Agent actions POST endpoints (invoke, pause, restart, snapshot)', () => {
    it('POST /console/agents/:agentId/invoke', async () => {
      mockTorqueQuery.invokeAgent.mockResolvedValue({ success: true } as any);

      const response = await fetch(`${baseUrl}/console/agents/ag1/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      });

      expect(response.status).toBe(200);
      expect(mockTorqueQuery.invokeAgent).toHaveBeenCalledWith('ag1', { action: 'run' });
    });

    it('POST /console/agents/:agentId/pause', async () => {
      mockTorqueQuery.pauseAgent.mockResolvedValue({ success: true } as any);

      const response = await fetch(`${baseUrl}/console/agents/ag1/pause`, { method: 'POST' });
      expect(response.status).toBe(200);
      expect(mockTorqueQuery.pauseAgent).toHaveBeenCalledWith('ag1');
    });

    it('POST /console/agents/:agentId/restart', async () => {
      mockTorqueQuery.restartAgent.mockResolvedValue({ success: true } as any);

      const response = await fetch(`${baseUrl}/console/agents/ag1/restart`, { method: 'POST' });
      expect(response.status).toBe(200);
      expect(mockTorqueQuery.restartAgent).toHaveBeenCalledWith('ag1');
    });

    it('POST /console/agents/:agentId/snapshot', async () => {
      mockTorqueQuery.snapshotAgent.mockResolvedValue({ snapshotId: 'snap-1' } as any);

      const response = await fetch(`${baseUrl}/console/agents/ag1/snapshot`, { method: 'POST' });
      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.data.snapshot).toEqual({ snapshotId: 'snap-1' });
    });
  });

  describe('POST /console/actions', () => {
    it('should return 400 when missing action field', async () => {
      const response = await fetch(`${baseUrl}/console/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as any;
      expect(body.error.code).toBe('MISSING_ACTION');
    });

    it('should execute action via TorqueQuery on valid request', async () => {
      mockTorqueQuery.executeAction.mockResolvedValue({ message: 'Action started' } as any);

      const response = await fetch(`${baseUrl}/console/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-phase', debugMode: true }),
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as any;
      expect(body.data.message).toBe('Action started');
    });
  });

  describe('GET /console/metrics and micro-cache', () => {
    it('should fetch metrics via console-metrics adapter and utilize 10ms micro-cache', async () => {
      mockAdapterService.execute.mockResolvedValue({
        data: { activeConnections: 12, cpuUsage: 0.15 },
      } as any);

      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/console/metrics`),
        fetch(`${baseUrl}/console/metrics`),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const body1 = (await res1.json()) as any;
      expect(body1.data.activeConnections).toBe(12);

      expect(mockAdapterService.execute).toHaveBeenCalledTimes(1);
    });

    it('should return 502 when adapter execute fails', async () => {
      await new Promise((r) => setTimeout(r, 20));
      mockAdapterService.execute.mockRejectedValue(new Error('Adapter failed'));

      const response = await fetch(`${baseUrl}/console/metrics`);
      expect(response.status).toBe(502);
      const body = (await response.json()) as any;
      expect(body.error.code).toBe('METRICS_UNAVAILABLE');
    });
  });
});
