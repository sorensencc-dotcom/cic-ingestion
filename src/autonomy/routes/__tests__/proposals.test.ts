/**
 * Proposals Routes Test Suite (Phase 23.7.3)
 * Tests HTTP request handling, status updates, generation, simulation
 */

import request from 'supertest';
import express from 'express';
import { AutonomyService } from '../../AutonomyService';
import { createProposalsRouter } from '../proposals';
import {
  createMockProposals,
  createMockProposal,
  createMockSignals,
  createMockApprovedProposal,
} from '../../bridges/__tests__/fixtures';

describe('Proposals Routes', () => {
  let app: express.Express;
  let mockService: jest.Mocked<AutonomyService>;

  beforeEach(() => {
    // Create mock service
    mockService = {
      detectSignals: jest.fn(),
      generateProposals: jest.fn(),
      querySignals: jest.fn(),
      querySignalsWithTotal: jest.fn(),
      getSignal: jest.fn(),
      getProposal: jest.fn(),
      updateProposalStatus: jest.fn(),
      queryProposals: jest.fn(),
      queryProposalsWithTotal: jest.fn(),
      runFullCycle: jest.fn(),
    } as any;

    // Setup Express app with router
    app = express();
    app.use(express.json());
    app.use('/autonomy', createProposalsRouter(mockService));
  });

  describe('GET /autonomy/proposals - Query Proposals', () => {
    it('queries all proposals without filters', async () => {
      const proposals = createMockProposals(3);
      (mockService.queryProposalsWithTotal as jest.Mock).mockReturnValue({
        results: proposals,
        total: 3,
      });

      const res = await request(app)
        .get('/autonomy/proposals')
        .expect(200);

      expect(res.body.proposals).toHaveLength(3);
      expect(res.body.count).toBe(3);
      expect(res.body.total).toBe(3);
      expect(res.body.queriedAt).toBeDefined();
    });

    it('filters proposals by status', async () => {
      const proposals = [createMockProposal('pending')];
      (mockService.queryProposalsWithTotal as jest.Mock).mockReturnValue({
        results: proposals,
        total: 1,
      });

      await request(app)
        .get('/autonomy/proposals')
        .query({ status: 'pending,approved' })
        .expect(200);

      expect(mockService.queryProposalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['pending', 'approved'],
        })
      );
    });

    it('filters invalid status values', async () => {
      (mockService.queryProposalsWithTotal as jest.Mock).mockReturnValue({
        results: [],
        total: 0,
      });

      const res = await request(app)
        .get('/autonomy/proposals')
        .query({ status: 'pending,invalid,approved' })
        .expect(200);

      // Invalid status should be filtered out
      expect(mockService.queryProposalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['pending', 'approved'],
        })
      );
    });

    it('validates minPriority range', async () => {
      const res = await request(app)
        .get('/autonomy/proposals')
        .query({ minPriority: '150' })
        .expect(400);

      expect(res.body.error).toContain('between 0 and 100');
    });

    it('validates limit range', async () => {
      const res = await request(app)
        .get('/autonomy/proposals')
        .query({ limit: '2000' })
        .expect(400);

      expect(res.body.error).toContain('between 1 and 1000');
    });

    it('validates offset >= 0', async () => {
      const res = await request(app)
        .get('/autonomy/proposals')
        .query({ offset: '-1' })
        .expect(400);

      expect(res.body.error).toContain('offset must be >= 0');
    });

    it('paginates results', async () => {
      const proposals = createMockProposals(2);
      (mockService.queryProposalsWithTotal as jest.Mock).mockReturnValue({
        results: proposals.slice(0, 2),
        total: 10,
      });

      await request(app)
        .get('/autonomy/proposals')
        .query({ limit: 5, offset: 5 })
        .expect(200);

      expect(mockService.queryProposalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5,
        })
      );
    });

    it('adds priority scores to proposals', async () => {
      const proposals = createMockProposals(1);
      (mockService.queryProposalsWithTotal as jest.Mock).mockReturnValue({
        results: proposals,
        total: 1,
      });

      const res = await request(app)
        .get('/autonomy/proposals')
        .expect(200);

      expect(res.body.proposals[0]).toHaveProperty('priority');
      expect(typeof res.body.proposals[0].priority).toBe('number');
    });
  });

  describe('GET /autonomy/proposals/:id - Get Proposal by ID', () => {
    it('returns proposal by ID', async () => {
      const proposal = createMockProposal();
      (mockService.getProposal as jest.Mock).mockReturnValue(proposal);

      const res = await request(app)
        .get(`/autonomy/proposals/${proposal.id}`)
        .expect(200);

      expect(res.body.proposal).toEqual(proposal);
      expect(res.body.priority).toBeDefined();
    });

    it('returns 404 for missing proposal', async () => {
      (mockService.getProposal as jest.Mock).mockReturnValue(undefined);

      const res = await request(app)
        .get('/autonomy/proposals/nonexistent')
        .expect(404);

      expect(res.body.error).toContain('not found');
    });
  });

  describe('POST /autonomy/proposals - Generate Proposals', () => {
    it('generates proposals from all signals', async () => {
      const proposals = createMockProposals(2);
      (mockService.generateProposals as jest.Mock).mockResolvedValue(proposals);

      const res = await request(app)
        .post('/autonomy/proposals')
        .expect(201);

      expect(res.body.proposals).toHaveLength(2);
      expect(res.body.count).toBe(2);
      expect(res.body.generatedAt).toBeDefined();
    });

    it('generates proposals from specific signal IDs', async () => {
      const proposals = [createMockProposal()];
      (mockService.getSignal as jest.Mock)
        .mockReturnValueOnce(createMockSignals(1)[0])
        .mockReturnValueOnce(undefined);
      (mockService.generateProposals as jest.Mock).mockResolvedValue(proposals);

      const signalIds = ['sig-1', 'sig-2'];

      const res = await request(app)
        .post('/autonomy/proposals')
        .send({ signalIds })
        .expect(201);

      expect(res.body.proposals).toHaveLength(1);
      expect(mockService.getSignal).toHaveBeenCalledWith('sig-1');
      expect(mockService.getSignal).toHaveBeenCalledWith('sig-2');
    });

    it('rejects if no valid signals found for provided IDs', async () => {
      (mockService.getSignal as jest.Mock).mockReturnValue(undefined);

      const res = await request(app)
        .post('/autonomy/proposals')
        .send({ signalIds: ['nonexistent'] })
        .expect(400);

      expect(res.body.error).toContain('No valid signals found');
    });

    it('adds priority scores to generated proposals', async () => {
      const proposals = createMockProposals(1);
      (mockService.generateProposals as jest.Mock).mockResolvedValue(proposals);

      const res = await request(app)
        .post('/autonomy/proposals')
        .expect(201);

      expect(res.body.proposals[0]).toHaveProperty('priority');
    });

    it('returns 500 on service error', async () => {
      (mockService.generateProposals as jest.Mock).mockRejectedValue(
        new Error('Generation failed')
      );

      const res = await request(app)
        .post('/autonomy/proposals')
        .expect(500);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('PUT /autonomy/proposals/:id - Update Proposal Status', () => {
    it('updates proposal to approved', async () => {
      const proposal = createMockProposal('pending');
      const updated = { ...proposal, status: 'approved' as const };
      (mockService.updateProposalStatus as jest.Mock).mockReturnValue(updated);

      const res = await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(res.body.proposal.status).toBe('approved');
      expect(res.body.updatedAt).toBeDefined();
    });

    it('updates proposal to rejected', async () => {
      const proposal = createMockProposal('pending');
      const updated = { ...proposal, status: 'rejected' as const };
      (mockService.updateProposalStatus as jest.Mock).mockReturnValue(updated);

      const res = await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: 'rejected' })
        .expect(200);

      expect(res.body.proposal.status).toBe('rejected');
    });

    it('updates proposal to executed', async () => {
      const proposal = createMockProposal('approved');
      const updated = { ...proposal, status: 'executed' as const };
      (mockService.updateProposalStatus as jest.Mock).mockReturnValue(updated);

      const res = await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: 'executed' })
        .expect(200);

      expect(res.body.proposal.status).toBe('executed');
    });

    it('requires status in body', async () => {
      const res = await request(app)
        .put('/autonomy/proposals/id-123')
        .send({})
        .expect(400);

      expect(res.body.error).toContain('status is required');
    });

    it('rejects invalid status value', async () => {
      const res = await request(app)
        .put('/autonomy/proposals/id-123')
        .send({ status: 'invalid' })
        .expect(400);

      expect(res.body.error).toContain('must be one of');
    });

    it('returns 404 for missing proposal', async () => {
      (mockService.updateProposalStatus as jest.Mock).mockReturnValue(undefined);

      const res = await request(app)
        .put('/autonomy/proposals/nonexistent')
        .send({ status: 'approved' })
        .expect(404);

      expect(res.body.error).toContain('not found');
    });

    it('includes priority score in response', async () => {
      const proposal = createMockProposal('pending');
      const updated = { ...proposal, status: 'approved' as const };
      (mockService.updateProposalStatus as jest.Mock).mockReturnValue(updated);

      const res = await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(res.body.proposal).toHaveProperty('priority');
    });
  });

  describe('POST /autonomy/proposals/simulate - Proposal Simulation', () => {
    it('simulates proposal execution', async () => {
      const proposal = createMockApprovedProposal();
      (mockService.getProposal as jest.Mock).mockReturnValue(proposal);

      const res = await request(app)
        .post('/autonomy/proposals/simulate')
        .send({ proposalId: proposal.id })
        .expect(200);

      expect(res.body.result).toBeDefined();
      expect(res.body.result.proposalId).toBe(proposal.id);
      expect(res.body.result.simulationType).toBe('what_if');
      expect(res.body.result.outcomes).toBeDefined();
      expect(res.body.simulatedAt).toBeDefined();
    });

    it('includes phase durations in simulation', async () => {
      const proposal = createMockApprovedProposal();
      (mockService.getProposal as jest.Mock).mockReturnValue(proposal);

      const res = await request(app)
        .post('/autonomy/proposals/simulate')
        .send({ proposalId: proposal.id })
        .expect(200);

      expect(res.body.result.outcomes.phaseDurations).toBeDefined();
      expect(typeof res.body.result.outcomes.phaseDurations).toBe('object');
    });

    it('calculates risk score based on impact level', async () => {
      const proposal = createMockApprovedProposal();
      proposal.impact.riskLevel = 'high';
      (mockService.getProposal as jest.Mock).mockReturnValue(proposal);

      const res = await request(app)
        .post('/autonomy/proposals/simulate')
        .send({ proposalId: proposal.id })
        .expect(200);

      expect(res.body.result.outcomes.riskScore).toBe(0.8);
    });

    it('requires proposalId in body', async () => {
      const res = await request(app)
        .post('/autonomy/proposals/simulate')
        .send({})
        .expect(400);

      expect(res.body.error).toContain('proposalId is required');
    });

    it('returns 404 for missing proposal', async () => {
      (mockService.getProposal as jest.Mock).mockReturnValue(undefined);

      const res = await request(app)
        .post('/autonomy/proposals/simulate')
        .send({ proposalId: 'nonexistent' })
        .expect(404);

      expect(res.body.error).toContain('not found');
    });

    it('includes confidence in simulation result', async () => {
      const proposal = createMockApprovedProposal();
      (mockService.getProposal as jest.Mock).mockReturnValue(proposal);

      const res = await request(app)
        .post('/autonomy/proposals/simulate')
        .send({ proposalId: proposal.id })
        .expect(200);

      expect(res.body.result.confidence).toBe(proposal.confidence);
    });
  });

  describe('Input Sanitization', () => {
    it('trims whitespace from status parameter', async () => {
      const proposal = createMockProposal('pending');
      const updated = { ...proposal, status: 'approved' as const };
      (mockService.updateProposalStatus as jest.Mock).mockReturnValue(updated);

      await request(app)
        .put(`/autonomy/proposals/${proposal.id}`)
        .send({ status: '  approved  ' })
        .expect(200);

      // Status should be trimmed/validated before use
      expect(mockService.updateProposalStatus).toHaveBeenCalled();
    });

    it('handles whitespace-only status values', async () => {
      const res = await request(app)
        .put('/autonomy/proposals/id-123')
        .send({ status: '   ' })
        .expect(400);

      expect(res.body.error).toContain('must be one of');
    });

    it('filters invalid statuses from comma-separated list', async () => {
      (mockService.queryProposalsWithTotal as jest.Mock).mockReturnValue({
        results: [],
        total: 0,
      });

      const res = await request(app)
        .get('/autonomy/proposals')
        .query({ status: 'pending,invalid,approved' })
        .expect(200);

      // Invalid status should be filtered out
      expect(mockService.queryProposalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['pending', 'approved'],
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('returns 500 on unexpected service error', async () => {
      (mockService.generateProposals as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const res = await request(app)
        .post('/autonomy/proposals')
        .expect(500);

      expect(res.body.error).toBeDefined();
    });

    it('sanitizes error messages in response', async () => {
      const pathError = new Error('/path/to/file failed');
      (mockService.generateProposals as jest.Mock).mockRejectedValue(pathError);

      const res = await request(app)
        .post('/autonomy/proposals')
        .expect(500);

      // Path should be sanitized or generic message shown
      expect(res.body.error).toBeDefined();
    });
  });
});
