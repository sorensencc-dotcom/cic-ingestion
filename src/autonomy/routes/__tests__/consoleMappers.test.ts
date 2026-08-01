import {
  mapTorqueHealthToConsole,
  mapTorquePipelinesToConsole,
  mapTorqueAlertsToConsole,
  mapTorqueWorkspaceToConsole,
  mapTorqueAgentsToConsole,
  mapTorqueAgentDetailToConsole,
} from '../mappers/consoleMappers';

describe('consoleMappers', () => {
  describe('mapTorqueHealthToConsole', () => {
    it('should map healthy status to green', () => {
      const res = mapTorqueHealthToConsole({ status: 'healthy', services: [{ name: 's1', status: 'ok' }] });
      expect(res.status).toBe('green');
      expect(res.lastErrorAt).toBeNull();
      expect(typeof res.uptimePercent).toBe('number');
    });

    it('should map degraded status to yellow and down to red with error timestamp', () => {
      const yellow = mapTorqueHealthToConsole({ status: 'degraded' });
      expect(yellow.status).toBe('yellow');
      expect(yellow.lastErrorAt).not.toBeNull();

      const red = mapTorqueHealthToConsole({ status: 'down' });
      expect(red.status).toBe('red');
      expect(red.lastErrorAt).not.toBeNull();
    });
  });

  describe('mapTorquePipelinesToConsole', () => {
    it('should map pipelines array', () => {
      const input = {
        pipelines: [
          { id: 'p1', name: 'Pipe 1', state: 'running', progress: 50, eta: 300 },
          { id: 'p2', name: 'Pipe 2', state: 'complete' },
          { id: 'p3', name: 'Pipe 3', state: 'error' },
        ],
      };

      const result = mapTorquePipelinesToConsole(input);
      expect(result).toHaveLength(3);

      expect(result[0].id).toBe('p1');
      expect(result[0].status).toBe('running');

      expect(result[1].id).toBe('p2');
      expect(result[1].status).toBe('complete');

      expect(result[2].id).toBe('p3');
      expect(result[2].status).toBe('failed');
    });

    it('should handle empty pipelines list gracefully', () => {
      expect(mapTorquePipelinesToConsole({})).toEqual([]);
    });
  });

  describe('mapTorqueAlertsToConsole', () => {
    it('should map alerts array and slice at 4 items maximum', () => {
      const input = {
        alerts: [
          { id: 'a1', severity: 'critical', message: 'CPU high', createdAt: '2026-08-01T00:00:00Z', source: 'host1' },
          { id: 'a2', severity: 'warning', message: 'Disk 80%' },
          { id: 'a3', severity: 'info', message: 'Deploy done' },
          { id: 'a4', severity: 'info', message: 'Backup complete' },
          { id: 'a5', severity: 'info', message: 'Extra alert' },
        ],
      };

      const result = mapTorqueAlertsToConsole(input);
      expect(result).toHaveLength(4);

      expect(result[0]).toEqual({
        id: 'a1',
        severity: 'critical',
        title: 'CPU high',
        message: 'CPU high',
        timestamp: '2026-08-01T00:00:00Z',
        source: 'host1',
      });
      expect(result[1].source).toBe('Unknown');
    });
  });

  describe('mapTorqueWorkspaceToConsole', () => {
    it('should map workspace user, permissions, and activity log', () => {
      const input = {
        userId: 'u123',
        userName: 'Alice',
        userEmail: 'alice@example.com',
        permissions: [{ name: 'read', granted: true }],
        activities: [{ id: 'act1', action: 'login', timestamp: '2026-08-01T01:02:03Z', actor: 'Alice' }],
      };

      const result = mapTorqueWorkspaceToConsole(input);
      expect(result.user).toEqual({
        id: 'u123',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'Operator',
      });
      expect(result.permissions).toEqual([{ name: 'read', granted: true }]);
      expect(result.activityLog).toEqual([
        { id: 'act1', action: 'login', timestamp: '2026-08-01T01:02:03Z', actor: 'Alice' },
      ]);
    });

    it('should provide fallbacks when input fields are empty', () => {
      const result = mapTorqueWorkspaceToConsole({});
      expect(result.user.id).toBe('user-001');
      expect(result.permissions).toHaveLength(3);
      expect(result.activityLog).toEqual([]);
    });
  });

  describe('mapTorqueAgentsToConsole', () => {
    it('should map agent list with health status and metrics', () => {
      const input = {
        agents: [
          { id: 'ag1', name: 'Agent 1', status: 'online', lastActivityAt: '2026-08-01T00:00:00Z' },
          { id: 'ag2', name: 'Agent 2', status: 'offline' },
        ],
      };

      const result = mapTorqueAgentsToConsole(input);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ag1');
      expect(result[0].status).toBe('online');
      expect(result[1].status).toBe('offline');
    });
  });

  describe('mapTorqueAgentDetailToConsole', () => {
    it('should map agent detail object with default structures', () => {
      const input = {
        id: 'ag-detail-1',
        name: 'Grok-Agent',
        version: '2.0.0',
        region: 'us-east-1',
        capabilities: ['code', 'search'],
      };

      const result = mapTorqueAgentDetailToConsole(input);
      expect(result.id).toBe('ag-detail-1');
      expect(result.metadata.name).toBe('Grok-Agent');
      expect(result.metadata.version).toBe('2.0.0');
      expect(result.metadata.capabilities).toEqual(['code', 'search']);
      expect(result.costTimeline).toHaveLength(20);
      expect(result.heartbeat.health).toBe('online');
    });
  });
});
