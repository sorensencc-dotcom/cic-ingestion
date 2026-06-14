/**
 * Routes Integration Tests (Phase 3)
 * HTTP → Service → Storage → HTTP workflow
 * Error propagation, validation, observability hooks
 */

import request from 'supertest';
import express from 'express';
import { AutonomyService, AutonomyServiceConfig } from '../../AutonomyService';
import { createSignalsRouter } from '../signals';
import { createProposalsRouter } from '../proposals';
import {
  createMockSignals,
  createMockProposal,
  createMockTimelineEvent,
} from '../../bridges/__tests__/fixtures';

describe('Routes Integration Tests', () => {
  let app: express.Express;
  let service: AutonomyService;

  beforeEach(() => {
    const config: AutonomyServiceConfig = {
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

    app = express();
    app.use(express.json());
    app.use('/autonomy', createSignalsRouter(service));
    app.use('/autonomy', createProposalsRouter(service));
  });

  describe('Signal Detection → Query → Status Flow', () => {
    it('detects signals and queries them back', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [createMockTimelineEvent()],
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
      const detectRes = await request(app)
        .post('/autonomy/signals')
        .expect(200);

      expect(detectRes.body.signals).toHaveLength(1);
      expect(detectRes.body.count).toBe(1);
      expect(detectRes.body.detectedAt).toBeDefined();

      // Step 2: Query signals
      const queryRes = await request(app)
        .get('/autonomy/signals')
        .expect(200);

      expect(queryRes.body.signals).toHaveLength(1);
      expect(queryRes.body.total).toBe(1);
    });

    it('filters signals by type through query endpoint', async () => {
      // Pre-populate with mixed signals
      createMockSignals(3).forEach((sig) => service['store'].addSignal(sig));

      const res = await request(app)
        .get('/autonomy/signals')
        .query({ type: 'drift' })
        .expect(200);

      expect(res.body.signals.every((s: any) => s.type === 'drift')).toBe(true);
    });

    it('respects pagination through query endpoint', async () => {
      createMockSignals(10).forEach((sig) => service['store'].addSignal(sig));

      const page1 = await request(app)
        .get('/autonomy/signals')
        .query({ limit: 3, offset: 0 })
        .expect(200);

      const page2 = await request(app)
        .get('/autonomy/signals')
        .query({ limit: 3, offset: 3 })
        .expect(200);

      expect(page1.body.signals).toHaveLength(3);
      expect(page2.body.signals).toHaveLength(3);
      expect(page1.body.signals[0].id).not.toBe(page2.body.signals[0].id);
    });

    it('returns 404 when signal not found by ID', async () => {
      const res = await request(app)
        .get('/autonomy/signals/nonexistent')
        .expect(404);

      expect(res.body.error).toContain('not found');
    });
  });

  describe('Proposal Generation → Update → Query Flow', () => {
    beforeEach(() => {
      // Pre-populate signals for proposal generation
      createMockSignals(2).forEach((sig) => service['store'].addSignal(sig));
    });

    it('generates proposals and updates status', async () => {
      const genRes = await request(app)
        .post('/autonomy/proposals')
        .expect(201);

      expect(genRes.body.proposals).toHaveLength(2);
      const proposalId = genRes.body.proposals[0].id;

      // Update status
      const updateRes = await request(app)
        .put(`/autonomy/proposals/${proposalId}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(updateRes.body.proposal.status).toBe('approved');

      // Query and verify
      const queryRes = await request(app)
        .get('/autonomy/proposals')
        .query({ status: 'approved' })
        .expect(200);

      expect(
        queryRes.body.proposals.find((p: any) => p.id === proposalId)
      ).toBeDefined();
    });

    it('allows proposal status state machine: pending → approved → executed', async () => {
      const proposal = createMockProposal('pending');
      service['store'].addProposal(proposal);

      // pending → approved
      let res = await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: 'approved' })
        .expect(200);
      expect(res.body.proposal.status).toBe('approved');

      // approved → executed
      res = await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: 'executed' })
        .expect(200);
      expect(res.body.proposal.status).toBe('executed');
    });

    it('returns 404 when proposal not found for update', async () => {
      const res = await request(app)
        .put('/autonomy/proposals/nonexistent')
        .send({ status: 'approved' })
        .expect(404);

      expect(res.body.error).toContain('not found');
    });

    it('filters proposals by status in query', async () => {
      const pending = createMockProposal('pending');
      const approved = createMockProposal('approved');

      service['store'].addProposal(pending);
      service['store'].addProposal(approved);

      // Verify proposals were added
      const allProposals = service.queryProposals({});
      expect(allProposals.length).toBeGreaterThanOrEqual(2);

      const res = await request(app)
        .get('/autonomy/proposals')
        .query({ status: 'pending' })
        .expect(200);

      expect(res.body.proposals.every((p: any) => p.status === 'pending')).toBe(
        true
      );
      expect(res.body.proposals.length).toBeGreaterThan(0);
      expect(res.body.total).toBe(1);
    });
  });

  describe('Error Propagation', () => {
    it('propagates MemoryQueryAPI errors from signal detection', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Connection refused'));

      const res = await request(app)
        .post('/autonomy/signals')
        .expect(500);

      expect(res.body.error).toContain('Connection refused');
    });

    it('returns validation error for invalid date format', async () => {
      const res = await request(app)
        .post('/autonomy/signals')
        .query({ startDate: 'not-a-date' })
        .expect(400);

      expect(res.body.error).toContain('Invalid date format');
    });

    it('returns validation error for start >= end date', async () => {
      const date = new Date().toISOString();

      const res = await request(app)
        .post('/autonomy/signals')
        .query({ startDate: date, endDate: date })
        .expect(400);

      expect(res.body.error).toContain('startDate must be before endDate');
    });

    it('returns 400 for invalid minConfidence', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .query({ minConfidence: '1.5' })
        .expect(400);

      expect(res.body.error).toContain('between 0.0 and 1.0');
    });

    it('returns 400 for invalid limit', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .query({ limit: '2000' })
        .expect(400);

      expect(res.body.error).toContain('between 1 and 1000');
    });

    it('returns 400 for negative offset', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .query({ offset: '-1' })
        .expect(400);

      expect(res.body.error).toContain('offset must be >= 0');
    });

    it('returns 500 on proposal generation service error', async () => {
      jest.spyOn(service, 'generateProposals').mockRejectedValueOnce(
        new Error('Generation failed')
      );

      const res = await request(app)
        .post('/autonomy/proposals')
        .expect(500);

      expect(res.body.error).toBeDefined();
    });

    it('sanitizes error messages in responses', async () => {
      jest.spyOn(service, 'detectSignals').mockRejectedValueOnce(
        new Error('/internal/path/to/file failed')
      );

      const res = await request(app)
        .post('/autonomy/signals')
        .expect(500);

      expect(res.body.error).toBeDefined();
      expect(res.body.error).not.toContain('/internal/path');
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('trims whitespace from type filter', async () => {
      createMockSignals(1).forEach((sig) => service['store'].addSignal(sig));

      const res = await request(app)
        .get('/autonomy/signals')
        .query({ type: ' drift ' })
        .expect(200);

      expect(res.body.query.type).toEqual(['drift']);
    });

    it('filters empty strings from comma-separated values', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .query({ type: 'drift,,instability,' })
        .expect(200);

      expect(res.body.query.type).toEqual(['drift', 'instability']);
    });

    it('handles whitespace-only values', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .query({ type: '   ,   ,   ' })
        .expect(200);

      expect(res.body.query.type).toEqual([]);
    });

    it('trims and validates proposal status', async () => {
      const proposal = createMockProposal('pending');
      service['store'].addProposal(proposal);

      const res = await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: '  approved  ' })
        .expect(200);

      expect(res.body.proposal.status).toBe('approved');
    });

    it('rejects invalid proposal status values', async () => {
      const proposal = createMockProposal('pending');
      service['store'].addProposal(proposal);

      const res = await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: 'invalid' })
        .expect(400);

      expect(res.body.error).toContain('must be one of');
    });

    it('requires status in proposal update', async () => {
      const res = await request(app)
        .put('/autonomy/proposals/id-123')
        .send({})
        .expect(400);

      expect(res.body.error).toContain('status is required');
    });
  });

  describe('Observability', () => {
    it('includes CAVEMAN_STATS in signal detection response', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [createMockTimelineEvent()],
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

      const res = await request(app)
        .post('/autonomy/signals')
        .expect(200);

      expect(res.body.CAVEMAN_STATS).toBeDefined();
      expect(res.body.CAVEMAN_STATS.bytesIn).toBeGreaterThan(0);
      expect(res.body.CAVEMAN_STATS.bytesOut).toBeGreaterThan(0);
    });

    it('includes CAVEMAN_STATS in signal query response', async () => {
      createMockSignals(2).forEach((sig) => service['store'].addSignal(sig));

      const res = await request(app)
        .get('/autonomy/signals')
        .expect(200);

      expect(res.body.CAVEMAN_STATS).toBeDefined();
      expect(res.body.CAVEMAN_STATS.ratio).toBeDefined();
    });

    it('includes timestamps in all responses', async () => {
      createMockSignals(1).forEach((sig) => service['store'].addSignal(sig));

      let res = await request(app)
        .get('/autonomy/signals')
        .expect(200);
      expect(res.body.queriedAt).toBeDefined();

      res = await request(app)
        .get('/autonomy/proposals')
        .expect(200);
      expect(res.body.queriedAt).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('handles concurrent signal and proposal requests', async () => {
      createMockSignals(3).forEach((sig) => service['store'].addSignal(sig));
      createMockSignals(3)
        .map(() => createMockProposal())
        .forEach((prop) => service['store'].addProposal(prop));

      const results = await Promise.all([
        request(app).get('/autonomy/signals').expect(200),
        request(app).get('/autonomy/proposals').expect(200),
        request(app).get('/autonomy/signals?type=drift').expect(200),
      ]);

      expect(results[0].body.signals).toBeDefined();
      expect(results[1].body.proposals).toBeDefined();
      expect(results[2].body.signals).toBeDefined();
    });

    it('handles concurrent proposal status updates', async () => {
      const proposals = [
        createMockProposal('pending'),
        createMockProposal('pending'),
        createMockProposal('pending'),
      ];

      proposals.forEach((p) => service['store'].addProposal(p));

      const updates = await Promise.all(
        proposals.map((p) =>
          request(app)
            .put(`/autonomy/proposals/${p.id}`)
            .send({ status: 'approved' })
        )
      );

      expect(updates.every((res) => res.status === 200)).toBe(true);
      expect(updates.every((res) => res.body.proposal.status === 'approved')).toBe(
        true
      );
    });
  });

  describe('Response Structure', () => {
    it('signal detection response has required fields', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [createMockTimelineEvent()],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      const res = await request(app)
        .post('/autonomy/signals')
        .expect(200);

      expect(res.body).toHaveProperty('signals');
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('window');
      expect(res.body).toHaveProperty('detectedAt');
      expect(res.body).toHaveProperty('CAVEMAN_STATS');
    });

    it('signal query response has required fields', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .expect(200);

      expect(res.body).toHaveProperty('signals');
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('query');
      expect(res.body).toHaveProperty('queriedAt');
      expect(res.body).toHaveProperty('CAVEMAN_STATS');
    });

    it('proposal query response has required fields', async () => {
      const res = await request(app)
        .get('/autonomy/proposals')
        .expect(200);

      expect(res.body).toHaveProperty('proposals');
      expect(res.body).toHaveProperty('count');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('queriedAt');
    });
  });
});
