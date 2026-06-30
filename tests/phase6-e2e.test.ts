import { Pool } from 'pg';
import { MetricsEngine } from '../src/metrics/MetricsEngine';
import { NightlyMetricsPipeline } from '../src/metrics/NightlyMetricsPipeline';
import { PrometheusExporter } from '../src/metrics/PrometheusExporter';
import { DriftDetectorEngine } from '../src/drift/DriftDetectorEngine';
import { GovernanceEnvelopeCache } from '../src/governance/GovernanceEnvelopeCache';
import { GovernanceReplayHarness } from '../src/governance/GovernanceReplayHarness';

describe('Phase 6 End-to-End', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      user: process.env.DB_USER || 'cic',
      password: process.env.DB_PASSWORD || 'cic',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'cic_lineage'
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('MetricsEngine', () => {
    test('should compute violation rate', async () => {
      const engine = new MetricsEngine(pool);
      const vr = await engine.computeViolationRate();
      expect(vr).toBeDefined();
      if (vr) {
        expect(vr.violation_rate).toBeGreaterThanOrEqual(0);
        expect(vr.violation_rate).toBeLessThanOrEqual(1);
      }
    });

    test('should compute rollback severity index', async () => {
      const engine = new MetricsEngine(pool);
      const rsi = await engine.computeRollbackSeverityIndex();
      expect(rsi).toBeDefined();
      if (rsi) {
        expect(rsi.rollback_severity_index).toBeGreaterThanOrEqual(0);
      }
    });

    test('should compute cohort stability score', async () => {
      const engine = new MetricsEngine(pool);
      const css = await engine.computeCohortStabilityScore();
      expect(css).toBeDefined();
      if (css) {
        expect(css.cohort_stability_score).toBeGreaterThanOrEqual(0);
        expect(css.cohort_stability_score).toBeLessThanOrEqual(1);
      }
    });

    test('should compute impact drift', async () => {
      const engine = new MetricsEngine(pool);
      const id = await engine.computeImpactDrift();
      expect(id).toBeDefined();
      if (id) {
        expect(id.impact_drift).toBeGreaterThanOrEqual(0);
      }
    });

    test('should compute governance risk snapshot', async () => {
      const engine = new MetricsEngine(pool);
      const grs = await engine.computeGovernanceRiskSnapshot();
      expect(grs).toBeDefined();
      if (grs) {
        expect(grs.avg_risk_score).toBeGreaterThanOrEqual(0);
        expect(grs.avg_threshold).toBeGreaterThanOrEqual(0.20);
        expect(grs.avg_threshold).toBeLessThanOrEqual(0.40);
        expect(grs.avg_lambda).toBeGreaterThanOrEqual(0.20);
        expect(grs.avg_lambda).toBeLessThanOrEqual(0.60);
      }
    });

    test('should compute all metrics', async () => {
      const engine = new MetricsEngine(pool);
      const result = await engine.computeNightlyMetrics();
      expect(result).toHaveProperty('vr');
      expect(result).toHaveProperty('rsi');
      expect(result).toHaveProperty('css');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('grs');
    });
  });

  describe('NightlyMetricsPipeline', () => {
    test('should run nightly pipeline without error', async () => {
      const engine = new MetricsEngine(pool);
      const pipeline = new NightlyMetricsPipeline(pool, engine);
      await expect(pipeline.run()).resolves.toBeUndefined();
    });
  });

  describe('PrometheusExporter', () => {
    test('should start prometheus exporter', (done) => {
      const exporter = new PrometheusExporter(pool, 9101);
      const server = exporter.start();
      setTimeout(() => {
        server.close(done);
      }, 100);
    });
  });

  describe('DriftDetectorEngine', () => {
    test('should evaluate drift alerts', async () => {
      const detector = new DriftDetectorEngine(pool);
      const alerts = await detector.evaluate();
      expect(Array.isArray(alerts)).toBe(true);
      alerts.forEach(alert => {
        expect(['impact', 'violation', 'stability', 'risk']).toContain(alert.type);
        expect(['low', 'medium', 'high']).toContain(alert.severity);
        expect(alert.message).toBeDefined();
        expect(alert.day).toBeDefined();
      });
    });
  });

  describe('GovernanceEnvelopeCache', () => {
    test('should load governance envelope', async () => {
      const cache = new GovernanceEnvelopeCache(pool);
      const envelopes = await cache.getAllEnvelopes();
      expect(Array.isArray(envelopes)).toBe(true);
    });

    test('should cache envelopes', async () => {
      const cache = new GovernanceEnvelopeCache(pool);
      const all = await cache.getAllEnvelopes();
      if (all.length > 0) {
        const env = await cache.loadEnvelope(all[0].proposal_id);
        expect(env).toBeDefined();
        expect(env?.proposal_id).toBe(all[0].proposal_id);
      }
    });

    test('should refresh envelope', async () => {
      const cache = new GovernanceEnvelopeCache(pool);
      const all = await cache.getAllEnvelopes();
      if (all.length > 0) {
        const refreshed = await cache.refreshEnvelope(all[0].proposal_id);
        expect(refreshed).toBeDefined();
      }
    });
  });

  describe('GovernanceReplayHarness', () => {
    test('should replay proposal timeline', async () => {
      const harness = new GovernanceReplayHarness(pool);
      const result = await harness.replayTimelineRange(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );
      expect(result).toBeInstanceOf(Map);
    });
  });
});
