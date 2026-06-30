import { Pool } from 'pg';
import { MetricsEngine } from './MetricsEngine';

export class NightlyMetricsPipeline {
  constructor(
    private readonly pool: Pool,
    private readonly engine: MetricsEngine
  ) {}

  async run(): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);

    const metrics = await this.engine.computeNightlyMetrics();

    if (!metrics.vr || !metrics.rsi || !metrics.css || !metrics.id || !metrics.grs) {
      console.warn(`[Phase6] Incomplete metrics for day ${day}, skipping ingestion`);
      return;
    }

    await this.pool.query(
      `
      SELECT nightly_metrics_upsert($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        day,
        metrics.vr.violation_rate,
        metrics.rsi.rollback_severity_index,
        metrics.css.cohort_stability_score,
        metrics.id.impact_drift,
        metrics.grs.avg_risk_score,
        metrics.grs.avg_threshold,
        metrics.grs.avg_lambda
      ]
    );

    console.log(`[Phase6] Nightly metrics computed for ${day}`);
  }
}
