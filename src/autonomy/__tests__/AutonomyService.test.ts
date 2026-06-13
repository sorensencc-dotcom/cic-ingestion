/**
 * AutonomyService Test Suite (Phase 23.7.3)
 * Tests signal detection, proposal generation, querying with filters/pagination
 */

import { AutonomyService } from '../AutonomyService';
import {
  createMockDriftSignal,
  createMockProposal,
  createMockSignals,
  createMockProposals,
} from '../bridges/__tests__/fixtures';

describe('AutonomyService', () => {
  let service: AutonomyService;

  const mockConfig = {
    memoryQueryApiUrl: 'http://localhost:3050',
    roadmapContext: {
      currentPhases: [
        {
          name: 'Phase 24',
          status: 'pending' as const,
          estimatedDuration: 168,
          dependencies: [],
          estimatedStartDate: new Date(),
          estimatedEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
      criticalPathPhases: ['Phase 24', 'Phase 25'],
      estimatedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  };

  beforeEach(() => {
    service = new AutonomyService(mockConfig);
  });

  describe('Signal Detection', () => {
    it('detects signals within date range', async () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = new Date();

      // Mock fetch for events/metrics
      global.fetch = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const signals = await service.detectSignals(start, end);
      expect(Array.isArray(signals)).toBe(true);
    });

    it('throws on fetch failure', async () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = new Date();

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(service.detectSignals(start, end)).rejects.toThrow('Failed to fetch events');
    });

    it('logs with window context on error', async () => {
      const start = new Date('2026-06-01T00:00:00Z');
      const end = new Date('2026-06-08T00:00:00Z');

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        await service.detectSignals(start, end);
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('2026-06-01'),
        expect.anything()
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('2026-06-08'),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Proposal Generation', () => {
    it('generates proposals from signals', async () => {
      const signals = createMockSignals(2);

      const proposals = await service.generateProposals(signals);
      expect(Array.isArray(proposals)).toBe(true);
    });

    it('generates proposals from stored signals if none provided', async () => {
      const signals = createMockSignals(3);
      for (const signal of signals) {
        service['store'].addSignal(signal);
      }

      const proposals = await service.generateProposals();
      expect(Array.isArray(proposals)).toBe(true);
    });

    it('returns empty array when no signals available', async () => {
      const proposals = await service.generateProposals([]);
      expect(proposals).toEqual([]);
    });

    it('stores generated proposals', async () => {
      const signals = createMockSignals(1);
      const proposals = await service.generateProposals(signals);

      for (const proposal of proposals) {
        expect(service.getProposal(proposal.id)).toBeDefined();
      }
    });
  });

  describe('Signal Querying', () => {
    beforeEach(() => {
      const signals = createMockSignals(5);
      for (const signal of signals) {
        service['store'].addSignal(signal);
      }
    });

    it('queries all signals without filters', () => {
      const result = service.querySignals({});
      expect(result.length).toBeGreaterThan(0);
    });

    it('filters signals by type', () => {
      const result = service.querySignals({ type: ['drift'] });
      expect(result.every((s) => s.type === 'drift')).toBe(true);
    });

    it('filters signals by severity', () => {
      const result = service.querySignals({ severity: ['critical'] });
      expect(result.every((s) => s.severity === 'critical')).toBe(true);
    });

    it('filters signals by phase', () => {
      const result = service.querySignals({ phase: ['Phase 24'] });
      expect(
        result.every((s) => s.affectedPhases.some((p) => p === 'Phase 24'))
      ).toBe(true);
    });

    it('filters signals by minimum confidence', () => {
      const minConf = 0.8;
      const result = service.querySignals({ minConfidence: minConf });
      expect(result.every((s) => s.confidence >= minConf)).toBe(true);
    });

    it('paginates results', () => {
      const result1 = service.querySignals({ limit: 2, offset: 0 });
      const result2 = service.querySignals({ limit: 2, offset: 2 });

      expect(result1.length).toBeLessThanOrEqual(2);
      expect(result2.length).toBeLessThanOrEqual(2);
      // Results should not overlap if sufficient signals exist
      if (result1.length > 0 && result2.length > 0) {
        expect(result1[0].id).not.toBe(result2[0].id);
      }
    });

    it('returns latest signals first', () => {
      const result = service.querySignals({});
      if (result.length >= 2) {
        const first = new Date(result[0].timestamp);
        const second = new Date(result[1].timestamp);
        expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
      }
    });
  });

  describe('Signal Query With Total', () => {
    beforeEach(() => {
      const signals = createMockSignals(10);
      for (const signal of signals) {
        service['store'].addSignal(signal);
      }
    });

    it('returns results and total in single query', () => {
      const { results, total } = service.querySignalsWithTotal({
        limit: 5,
        offset: 0,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(typeof total).toBe('number');
      expect(total).toBeGreaterThanOrEqual(results.length);
    });

    it('total reflects filtered results', () => {
      const { total } = service.querySignalsWithTotal({
        type: ['drift'],
        limit: 100,
      });

      const allDrift = service.querySignals({ type: ['drift'] });
      expect(total).toBe(allDrift.length);
    });

    it('respects pagination in results', () => {
      const { results } = service.querySignalsWithTotal({
        limit: 3,
        offset: 0,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Proposal Querying', () => {
    beforeEach(() => {
      const proposals = createMockProposals(6);
      for (const proposal of proposals) {
        service['store'].addProposal(proposal);
      }
    });

    it('queries all proposals without filters', () => {
      const result = service.queryProposals({});
      expect(result.length).toBeGreaterThan(0);
    });

    it('filters proposals by status', () => {
      const result = service.queryProposals({ status: ['pending'] });
      expect(result.every((p) => p.status === 'pending')).toBe(true);
    });

    it('filters proposals by multiple statuses', () => {
      const result = service.queryProposals({
        status: ['pending', 'approved'],
      });
      expect(
        result.every((p) => ['pending', 'approved'].includes(p.status))
      ).toBe(true);
    });

    it('paginates proposal results', () => {
      const result1 = service.queryProposals({ limit: 2, offset: 0 });
      const result2 = service.queryProposals({ limit: 2, offset: 2 });

      expect(result1.length).toBeLessThanOrEqual(2);
      expect(result2.length).toBeLessThanOrEqual(2);
    });

    it('returns latest proposals first', () => {
      const result = service.queryProposals({});
      if (result.length >= 2) {
        const first = new Date(result[0].timestamp);
        const second = new Date(result[1].timestamp);
        expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
      }
    });
  });

  describe('Proposal Query With Total', () => {
    beforeEach(() => {
      const proposals = createMockProposals(8);
      for (const proposal of proposals) {
        service['store'].addProposal(proposal);
      }
    });

    it('returns proposals and total count', () => {
      const { results, total } = service.queryProposalsWithTotal({
        limit: 4,
        offset: 0,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(typeof total).toBe('number');
      expect(results.length).toBeLessThanOrEqual(total);
    });

    it('total reflects status filter', () => {
      const { total } = service.queryProposalsWithTotal({
        status: ['approved'],
      });

      const allApproved = service.queryProposals({ status: ['approved'] });
      expect(total).toBe(allApproved.length);
    });
  });

  describe('Get by ID', () => {
    it('retrieves signal by ID', () => {
      const signal = createMockDriftSignal();
      service['store'].addSignal(signal);

      const retrieved = service.getSignal(signal.id);
      expect(retrieved).toEqual(signal);
    });

    it('returns undefined for missing signal', () => {
      const signal = service.getSignal('nonexistent');
      expect(signal).toBeUndefined();
    });

    it('retrieves proposal by ID', () => {
      const proposal = createMockProposal();
      service['store'].addProposal(proposal);

      const retrieved = service.getProposal(proposal.id);
      expect(retrieved).toEqual(proposal);
    });

    it('returns undefined for missing proposal', () => {
      const proposal = service.getProposal('nonexistent');
      expect(proposal).toBeUndefined();
    });
  });

  describe('Proposal Status Update', () => {
    it('updates proposal status', () => {
      const proposal = createMockProposal('pending');
      service['store'].addProposal(proposal);

      const updated = service.updateProposalStatus(proposal.id, 'approved');
      expect(updated?.status).toBe('approved');
    });

    it('returns updated proposal from store', () => {
      const proposal = createMockProposal('pending');
      service['store'].addProposal(proposal);

      service.updateProposalStatus(proposal.id, 'executed');
      const retrieved = service.getProposal(proposal.id);
      expect(retrieved?.status).toBe('executed');
    });

    it('returns undefined for nonexistent proposal', () => {
      const result = service.updateProposalStatus('nonexistent', 'approved');
      expect(result).toBeUndefined();
    });
  });

  describe('Full Autonomy Cycle', () => {
    it('runs detect → generate → store cycle', async () => {
      global.fetch = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = new Date();

      const { signals, proposals } = await service.runFullCycle(start, end);

      expect(Array.isArray(signals)).toBe(true);
      expect(Array.isArray(proposals)).toBe(true);
    });
  });
});
