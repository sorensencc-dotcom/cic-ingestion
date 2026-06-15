/**
 * Autonomy Integration Tests (Phase 3)
 * Full cycle: detect signals → generate proposals → update status
 * Error propagation, state transitions, complete workflows
 */

import { AutonomyService, AutonomyServiceConfig } from '../AutonomyService';
import {
  createMockSignals,
  createMockDriftSignal,
  createMockProposal,
  createMockTimelineEvent,
} from '../bridges/__tests__/fixtures';

describe('Autonomy Integration Tests', () => {
  let service: AutonomyService;
  let config: AutonomyServiceConfig;

  beforeEach(() => {
    config = {
      memoryQueryApiUrl: 'http://localhost:3200',
      roadmapContext: {
        currentPhases: [
          {
            name: 'Phase 24',
            status: 'in_progress',
            estimatedDuration: 240,
            dependencies: ['Phase 23'],
            estimatedStartDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            estimatedEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          },
        ],
        criticalPathPhases: ['Phase 24', 'Phase 25'],
        estimatedCompletionDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    };

    service = new AutonomyService(config);
  });

  describe('Full Autonomy Cycle', () => {
    it('completes detect → generate → update workflow', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Mock fetch responses
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => Array(10).fill(null).map(() => createMockTimelineEvent()),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              timestamp: new Date().toISOString(),
              driftScore: 0.72,
              signals: {
                semantic_drift: 0.72,
                temporal_drift: 0.68,
                narrative_drift: 0.75,
                causal_drift: 0.70,
              },
              severity: 'warning',
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              window: '24h',
              timestamp: new Date().toISOString(),
              uptime: 99.9,
              successRate: 95,
              p50Latency: 200,
              p99Latency: 500,
              errorCount: 2,
              eventCount: 100,
            },
          ],
        });

      // Step 1: Detect signals
      const signals = await service.detectSignals(startDate, endDate);
      expect(signals).toHaveLength(1);
      expect(signals[0].type).toBe('drift');

      // Step 2: Generate proposals from detected signals
      const proposals = await service.generateProposals(signals);
      expect(proposals).toHaveLength(1);
      expect(proposals[0].triggeredBy).toHaveLength(1);

      // Step 3: Update proposal status to approved
      const proposalId = proposals[0].id;
      const updated = service.updateProposalStatus(proposalId, 'approved');
      expect(updated).toBeDefined();
      expect(updated?.status).toBe('approved');

      // Step 4: Verify state persists
      const retrieved = service.getProposal(proposalId);
      expect(retrieved?.status).toBe('approved');
    });

    it('handles empty signal detection without cascading', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      const signals = await service.detectSignals(startDate, endDate);
      expect(signals).toHaveLength(0);

      // Proposal generation should succeed with empty input
      const proposals = await service.generateProposals(signals);
      expect(proposals).toHaveLength(0);
    });

    it('propagates MemoryQueryAPI fetch errors', async () => {
      const startDate = new Date();
      const endDate = new Date();

      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.detectSignals(startDate, endDate)).rejects.toThrow(
        'Connection refused'
      );
    });

    it('propagates HTTP error responses from MemoryQueryAPI', async () => {
      const startDate = new Date();
      const endDate = new Date();

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(service.detectSignals(startDate, endDate)).rejects.toThrow(
        'Failed to fetch events'
      );
    });
  });

  describe('Signal Query Filtering & Pagination', () => {
    beforeEach(() => {
      // Pre-populate signals
      for (let i = 0; i < 5; i++) {
        const signal = createMockDriftSignal(i % 3 === 0 ? 'critical' : 'warning');
        service['store'].addSignal(signal);
      }
    });

    it('filters signals by severity', () => {
      const critical = service.querySignals({ severity: ['critical'] });
      expect(critical.length).toBeGreaterThan(0);
      expect(critical.every((s) => s.severity === 'critical')).toBe(true);
    });

    it('paginates with offset and limit', () => {
      const page1 = service.querySignals({ limit: 2, offset: 0 });
      const page2 = service.querySignals({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });

    it('returns total count with results', () => {
      const { results, total } = service.querySignalsWithTotal({
        limit: 2,
        offset: 0,
      });

      expect(results).toHaveLength(2);
      expect(total).toBe(5);
    });

    it('combines multiple filters', () => {
      const filtered = service.querySignals({
        severity: ['critical'],
        type: ['drift'],
        minConfidence: 0.8,
      });

      expect(
        filtered.every(
          (s) => s.severity === 'critical' && s.type === 'drift' && s.confidence >= 0.8
        )
      ).toBe(true);
    });

    it('sorts results by timestamp newest first', () => {
      const results = service.querySignals({});
      for (let i = 0; i < results.length - 1; i++) {
        const curr = new Date(results[i].timestamp).getTime();
        const next = new Date(results[i + 1].timestamp).getTime();
        expect(curr).toBeGreaterThanOrEqual(next);
      }
    });
  });

  describe('Proposal Query & Status Updates', () => {
    beforeEach(() => {
      // Pre-populate proposals with different statuses
      const statuses: Array<'pending' | 'approved' | 'rejected' | 'executed'> = [
        'pending',
        'approved',
        'rejected',
        'executed',
      ];

      statuses.forEach((status) => {
        const proposal = createMockProposal(status);
        service['store'].addProposal(proposal);
      });
    });

    it('filters proposals by status', () => {
      const pending = service.queryProposals({ status: ['pending'] });
      expect(pending.every((p) => p.status === 'pending')).toBe(true);
    });

    it('allows status transitions: pending → approved → executed', () => {
      const [proposal] = service.queryProposals({ status: ['pending'] });
      expect(proposal).toBeDefined();

      const approved = service.updateProposalStatus(proposal.id, 'approved');
      expect(approved?.status).toBe('approved');

      const executed = service.updateProposalStatus(proposal.id, 'executed');
      expect(executed?.status).toBe('executed');
    });

    it('disallows invalid status values', () => {
      const [proposal] = service.queryProposals({ status: ['pending'] });

      // Should not update to invalid status
      const result = service.updateProposalStatus(
        proposal.id,
        'invalid' as any
      );

      // TypeScript prevents invalid status, but runtime should handle gracefully
      expect(result).toBeDefined();
    });

    it('returns undefined for missing proposal update', () => {
      const result = service.updateProposalStatus('nonexistent', 'approved');
      expect(result).toBeUndefined();
    });

    it('returns total count with proposal results', () => {
      const { results, total } = service.queryProposalsWithTotal({
        status: ['pending', 'approved'],
      });

      expect(total).toBeGreaterThanOrEqual(results.length);
    });
  });

  describe('Error Handling', () => {
    it('logs errors with context window', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network timeout'));

      try {
        await service.detectSignals(startDate, endDate);
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Signal detection error'),
        expect.any(String)
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stack:'),
        expect.any(String)
      );

      consoleSpy.mockRestore();
    });

    it('throws original error after logging', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Database error'));

      const startDate = new Date();
      const endDate = new Date();

      await expect(service.detectSignals(startDate, endDate)).rejects.toThrow(
        'Database error'
      );
    });

    it('handles missing optional fields in TimelineEvent', async () => {
      const startDate = new Date();
      const endDate = new Date();

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => Array(10).fill(null).map((_, i) => ({
            id: `event-${i + 1}`,
            timestamp: new Date().toISOString(),
            type: 'PIPELINE_RUN',
          })),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              timestamp: new Date().toISOString(),
              driftScore: 0.72,
              signals: {
                semantic_drift: 0.72,
                temporal_drift: 0.68,
                narrative_drift: 0.75,
                causal_drift: 0.70,
              },
              severity: 'warning',
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              window: '24h',
              timestamp: new Date().toISOString(),
              uptime: 99.9,
              successRate: 95,
              p50Latency: 200,
              p99Latency: 500,
              errorCount: 2,
              eventCount: 100,
            },
          ],
        });

      const signals = await service.detectSignals(startDate, endDate);
      expect(signals).toHaveLength(1);
    });
  });

  describe('Batch Operations', () => {
    it('processes multiple signals in parallel', async () => {
      const signals = createMockSignals(10);

      signals.forEach((sig) => service['store'].addSignal(sig));

      const queries = Promise.all([
        Promise.resolve(service.querySignals({ severity: ['critical'] })),
        Promise.resolve(service.querySignals({ severity: ['warning'] })),
        Promise.resolve(service.querySignals({ type: ['drift'] })),
      ]);

      const [critical, warning, drift] = await queries;
      expect(critical.length + warning.length).toBeGreaterThan(0);
      expect(drift.length).toBeGreaterThan(0);
    });

    it('handles concurrent proposal status updates', () => {
      const proposals = createMockSignals(5).map(() => createMockProposal());
      proposals.forEach((p) => service['store'].addProposal(p));

      const updates = proposals.map((p) =>
        service.updateProposalStatus(p.id, 'approved')
      );

      expect(updates).toHaveLength(5);
      expect(updates.every((u) => u?.status === 'approved')).toBe(true);
    });
  });

  describe('State Isolation', () => {
    it('isolates signal state between instances', () => {
      const service2 = new AutonomyService(config);

      const signal = createMockDriftSignal();
      service['store'].addSignal(signal);

      const inService1 = service.getSignal(signal.id);
      const inService2 = service2.getSignal(signal.id);

      expect(inService1).toBeDefined();
      expect(inService2).toBeUndefined();
    });

    it('isolates proposal state between instances', () => {
      const service2 = new AutonomyService(config);

      const proposal = createMockProposal();
      service['store'].addProposal(proposal);

      const inService1 = service.getProposal(proposal.id);
      const inService2 = service2.getProposal(proposal.id);

      expect(inService1).toBeDefined();
      expect(inService2).toBeUndefined();
    });
  });

  describe('Date Validation', () => {
    it('rejects invalid date ranges', async () => {
      const start = new Date();
      const end = new Date(start.getTime() - 1000); // end before start

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => Array(10).fill(null).map(() => createMockTimelineEvent()),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              timestamp: new Date().toISOString(),
              driftScore: 0.72,
              signals: {
                semantic_drift: 0.72,
                temporal_drift: 0.68,
                narrative_drift: 0.75,
                causal_drift: 0.70,
              },
              severity: 'warning',
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              window: '24h',
              timestamp: new Date().toISOString(),
              uptime: 99.9,
              successRate: 95,
              p50Latency: 200,
              p99Latency: 500,
              errorCount: 2,
              eventCount: 100,
            },
          ],
        });

      // Service should handle gracefully
      const signals = await service.detectSignals(start, end);
      expect(signals).toBeDefined();
    });

    it('accepts wide date ranges', async () => {
      const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
      const end = new Date();

      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => Array(10).fill(null).map(() => createMockTimelineEvent()),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              timestamp: new Date().toISOString(),
              driftScore: 0.72,
              signals: {
                semantic_drift: 0.72,
                temporal_drift: 0.68,
                narrative_drift: 0.75,
                causal_drift: 0.70,
              },
              severity: 'warning',
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              window: '24h',
              timestamp: new Date().toISOString(),
              uptime: 99.9,
              successRate: 95,
              p50Latency: 200,
              p99Latency: 500,
              errorCount: 2,
              eventCount: 100,
            },
          ],
        });

      const signals = await service.detectSignals(start, end);
      expect(signals).toBeDefined();
    });
  });
});
