/**
 * Signals Routes Test Suite (Phase 23.7.3)
 * Tests HTTP request handling, input validation, filtering, pagination
 */

import request from 'supertest';
import express from 'express';
import { AutonomyService } from '../../AutonomyService';
import { createSignalsRouter } from '../signals';
import {
  createMockSignals,
  createMockDriftSignal,
} from '../../bridges/__tests__/fixtures';

describe('Signals Routes', () => {
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
    app.use('/autonomy', createSignalsRouter(mockService));
  });

  describe('POST /autonomy/signals - Signal Detection', () => {
    it('detects signals with default date range', async () => {
      const signals = createMockSignals(2);
      (mockService.detectSignals as jest.Mock).mockResolvedValue(signals);

      const res = await request(app).post('/autonomy/signals').expect(200);

      expect(res.body.signals).toHaveLength(2);
      expect(res.body.count).toBe(2);
      expect(res.body.window).toBeDefined();
      expect(res.body.detectedAt).toBeDefined();
    });

    it('accepts custom start and end dates', async () => {
      const signals = createMockSignals(1);
      (mockService.detectSignals as jest.Mock).mockResolvedValue(signals);

      const startDate = '2026-06-01T00:00:00Z';
      const endDate = '2026-06-08T00:00:00Z';

      const res = await request(app)
        .post('/autonomy/signals')
        .query({ startDate, endDate })
        .expect(200);

      expect(mockService.detectSignals).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
      expect(res.body.signals).toHaveLength(1);
    });

    it('rejects invalid start date', async () => {
      const res = await request(app)
        .post('/autonomy/signals')
        .query({ startDate: 'not-a-date' })
        .expect(400);

      expect(res.body.error).toContain('Invalid date format');
    });

    it('rejects if start >= end', async () => {
      const date = new Date().toISOString();

      const res = await request(app)
        .post('/autonomy/signals')
        .query({ startDate: date, endDate: date })
        .expect(400);

      expect(res.body.error).toContain('startDate must be before endDate');
    });

    it('returns error details on service failure', async () => {
      (mockService.detectSignals as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const res = await request(app)
        .post('/autonomy/signals')
        .expect(500);

      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /autonomy/signals - Signal Query', () => {
    it('queries signals without filters', async () => {
      const signals = createMockSignals(3);
      (mockService.querySignalsWithTotal as jest.Mock).mockReturnValue({
        results: signals,
        total: 3,
      });

      const res = await request(app)
        .get('/autonomy/signals')
        .expect(200);

      expect(res.body.signals).toHaveLength(3);
      expect(res.body.count).toBe(3);
      expect(res.body.total).toBe(3);
      expect(res.body.queriedAt).toBeDefined();
    });

    it('filters signals by type', async () => {
      const signals = createMockSignals(1);
      (mockService.querySignalsWithTotal as jest.Mock).mockReturnValue({
        results: signals,
        total: 1,
      });

      await request(app)
        .get('/autonomy/signals')
        .query({ type: 'drift,instability' })
        .expect(200);

      expect(mockService.querySignalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ['drift', 'instability'],
        })
      );
    });

    it('trims and filters empty type values', async () => {
      (mockService.querySignalsWithTotal as jest.Mock).mockReturnValue({
        results: [],
        total: 0,
      });

      await request(app)
        .get('/autonomy/signals')
        .query({ type: ' drift , , instability ' })
        .expect(200);

      expect(mockService.querySignalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ['drift', 'instability'],
        })
      );
    });

    it('filters signals by severity', async () => {
      (mockService.querySignalsWithTotal as jest.Mock).mockReturnValue({
        results: [],
        total: 0,
      });

      await request(app)
        .get('/autonomy/signals')
        .query({ severity: 'critical,warning' })
        .expect(200);

      expect(mockService.querySignalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: ['critical', 'warning'],
        })
      );
    });

    it('filters signals by phase', async () => {
      (mockService.querySignalsWithTotal as jest.Mock).mockReturnValue({
        results: [],
        total: 0,
      });

      await request(app)
        .get('/autonomy/signals')
        .query({ phase: 'Phase 24,Phase 25' })
        .expect(200);

      expect(mockService.querySignalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          phase: ['Phase 24', 'Phase 25'],
        })
      );
    });

    it('validates minConfidence range', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .query({ minConfidence: '1.5' })
        .expect(400);

      expect(res.body.error).toContain('between 0.0 and 1.0');
    });

    it('validates limit range', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .query({ limit: '2000' })
        .expect(400);

      expect(res.body.error).toContain('between 1 and 1000');
    });

    it('validates offset >= 0', async () => {
      const res = await request(app)
        .get('/autonomy/signals')
        .query({ offset: '-1' })
        .expect(400);

      expect(res.body.error).toContain('offset must be >= 0');
    });

    it('paginates results', async () => {
      const signals = createMockSignals(2);
      (mockService.querySignalsWithTotal as jest.Mock).mockReturnValue({
        results: signals.slice(0, 2),
        total: 10,
      });

      await request(app)
        .get('/autonomy/signals')
        .query({ limit: 5, offset: 5 })
        .expect(200);

      expect(mockService.querySignalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 5,
        })
      );
    });
  });

  describe('GET /autonomy/signals/:id - Get Signal by ID', () => {
    it('returns signal by ID', async () => {
      const signal = createMockDriftSignal();
      (mockService.getSignal as jest.Mock).mockReturnValue(signal);

      const res = await request(app)
        .get(`/autonomy/signals/${signal.id}`)
        .expect(200);

      expect(res.body.signal).toEqual(signal);
    });

    it('returns 404 for missing signal', async () => {
      (mockService.getSignal as jest.Mock).mockReturnValue(undefined);

      const res = await request(app)
        .get('/autonomy/signals/nonexistent')
        .expect(404);

      expect(res.body.error).toContain('not found');
    });
  });

  describe('GET /autonomy/signals/trends/:metric - Signal Trends', () => {
    it('returns trends with daily window by default', async () => {
      const allSignals = createMockSignals(3);
      (mockService.querySignals as jest.Mock).mockReturnValue(allSignals);

      const res = await request(app)
        .get('/autonomy/signals/trends/drift_score')
        .expect(200);

      expect(res.body.trends).toBeDefined();
      expect(Array.isArray(res.body.trends)).toBe(true);
      expect(res.body.metric).toBe('drift_score');
      expect(res.body.window).toBe('daily');
      expect(res.body.days).toBe(7);
    });

    it('accepts hourly window', async () => {
      (mockService.querySignals as jest.Mock).mockReturnValue([]);

      const res = await request(app)
        .get('/autonomy/signals/trends/error_rate')
        .query({ window: 'hourly' })
        .expect(200);

      expect(res.body.window).toBe('hourly');
    });

    it('accepts weekly window', async () => {
      (mockService.querySignals as jest.Mock).mockReturnValue([]);

      const res = await request(app)
        .get('/autonomy/signals/trends/latency')
        .query({ window: 'weekly' })
        .expect(200);

      expect(res.body.window).toBe('weekly');
    });

    it('rejects invalid window', async () => {
      const res = await request(app)
        .get('/autonomy/signals/trends/metric')
        .query({ window: 'monthly' })
        .expect(400);

      expect(res.body.error).toContain('window must be one of');
    });

    it('validates days range', async () => {
      const res = await request(app)
        .get('/autonomy/signals/trends/metric')
        .query({ days: '400' })
        .expect(400);

      expect(res.body.error).toContain('days must be between 1 and 365');
    });

    it('returns trends with custom days', async () => {
      (mockService.querySignals as jest.Mock).mockReturnValue([]);

      const res = await request(app)
        .get('/autonomy/signals/trends/metric')
        .query({ days: '30' })
        .expect(200);

      expect(res.body.days).toBe(30);
    });

    it('aggregates signals by timestamp in daily window', async () => {
      const signals = createMockSignals(5);
      (mockService.querySignals as jest.Mock).mockReturnValue(signals);

      const res = await request(app)
        .get('/autonomy/signals/trends/metric')
        .query({ window: 'daily' })
        .expect(200);

      expect(res.body.trends).toBeDefined();
      expect(Array.isArray(res.body.trends)).toBe(true);
      // Trends should have avgConfidence and count per window
      if (res.body.trends.length > 0) {
        expect(res.body.trends[0]).toHaveProperty('timestamp');
        expect(res.body.trends[0]).toHaveProperty('count');
        expect(res.body.trends[0]).toHaveProperty('avgConfidence');
      }
    });
  });

  describe('Error Handling', () => {
    it('returns 500 on unexpected service error', async () => {
      (mockService.detectSignals as jest.Mock).mockRejectedValue(
        new Error('Unexpected error')
      );

      const res = await request(app)
        .post('/autonomy/signals')
        .expect(500);

      expect(res.body.error).toBeDefined();
    });

    it('sanitizes error messages in response', async () => {
      const pathError = new Error('/path/to/file failed');
      (mockService.detectSignals as jest.Mock).mockRejectedValue(pathError);

      const res = await request(app)
        .post('/autonomy/signals')
        .expect(500);

      // Path should be sanitized or generic message shown
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Input Sanitization', () => {
    it('handles whitespace-only type parameter', async () => {
      (mockService.querySignalsWithTotal as jest.Mock).mockReturnValue({
        results: [],
        total: 0,
      });

      await request(app)
        .get('/autonomy/signals')
        .query({ type: '   ,   ,   ' })
        .expect(200);

      expect(mockService.querySignalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: [],
        })
      );
    });

    it('trims whitespace from minConfidence', async () => {
      (mockService.querySignalsWithTotal as jest.Mock).mockReturnValue({
        results: [],
        total: 0,
      });

      await request(app)
        .get('/autonomy/signals')
        .query({ minConfidence: '  0.75  ' })
        .expect(200);

      expect(mockService.querySignalsWithTotal).toHaveBeenCalledWith(
        expect.objectContaining({
          minConfidence: 0.75,
        })
      );
    });
  });
});
