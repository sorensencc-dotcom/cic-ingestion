import { Pool } from 'pg';

export interface ViolationRateResult {
  day: string;
  violation_rate: number;
}

export interface RollbackSeverityResult {
  day: string;
  rollback_severity_index: number;
}

export interface CohortStabilityResult {
  day: string;
  cohort_stability_score: number;
}

export interface ImpactDriftResult {
  day: string;
  impact_drift: number;
}

export interface GovernanceRiskResult {
  day: string;
  avg_risk_score: number;
  avg_threshold: number;
  avg_lambda: number;
}

export class MetricsEngine {
  constructor(private readonly pool: Pool) {}

  async computeNightlyMetrics(): Promise<{
    vr: ViolationRateResult | null;
    rsi: RollbackSeverityResult | null;
    css: CohortStabilityResult | null;
    id: ImpactDriftResult | null;
    grs: GovernanceRiskResult | null;
  }> {
    const vr = await this.computeViolationRate();
    const rsi = await this.computeRollbackSeverityIndex();
    const css = await this.computeCohortStabilityScore();
    const id = await this.computeImpactDrift();
    const grs = await this.computeGovernanceRiskSnapshot();

    return { vr, rsi, css, id, grs };
  }

  async computeViolationRate(): Promise<ViolationRateResult | null> {
    const sql = `
      SELECT
        date_trunc('day', occurred_at)::DATE AS day,
        COUNT(*) FILTER (WHERE event_type='violation')::float
          / GREATEST(COUNT(*) FILTER (WHERE event_type IN ('canary_start','canary_end')), 1)
          AS violation_rate
      FROM audit_log
      WHERE occurred_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(sql);
    return rows[0] || null;
  }

  async computeRollbackSeverityIndex(): Promise<RollbackSeverityResult | null> {
    const sql = `
      SELECT
        date_trunc('day', occurred_at)::DATE AS day,
        SUM(
          CASE severity
            WHEN 'low'    THEN 1
            WHEN 'medium' THEN 2
            WHEN 'high'   THEN 3
            ELSE 0
          END
        ) AS rollback_severity_index
      FROM audit_log
      WHERE event_type='rollback'
        AND occurred_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(sql);
    return rows[0] || null;
  }

  async computeCohortStabilityScore(): Promise<CohortStabilityResult | null> {
    const sql = `
      SELECT
        date_trunc('day', occurred_at)::DATE AS day,
        AVG(stability_score) AS cohort_stability_score
      FROM (
        SELECT
          occurred_at,
          metadata->>'cohort_id' AS cohort_id,
          1.0 / (1.0 + COALESCE(STDDEV_POP((metadata->>'metric_delta')::float) OVER (
            PARTITION BY metadata->>'cohort_id', date_trunc('day', occurred_at)
          ), 0)) AS stability_score
        FROM canary_state_history
        WHERE state = 'canary_end'
          AND occurred_at >= NOW() - INTERVAL '30 days'
      ) s
      GROUP BY day
      ORDER BY day DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(sql);
    return rows[0] || null;
  }

  async computeImpactDrift(): Promise<ImpactDriftResult | null> {
    const sql = `
      SELECT
        date_trunc('day', occurred_at)::DATE AS day,
        AVG(ABS((details->>'actual')::float - (details->>'expected')::float)) AS impact_drift
      FROM audit_log
      WHERE event_type = 'impact_measurement'
        AND occurred_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day DESC
      LIMIT 1;
    `;
    const { rows } = await this.pool.query(sql);
    return rows[0] || null;
  }

  async computeGovernanceRiskSnapshot(): Promise<GovernanceRiskResult | null> {
    const sql = `
      SELECT
        CURRENT_DATE::DATE AS day,
        AVG(risk_score) AS avg_risk_score,
        AVG(hybrid_threshold) AS avg_threshold,
        AVG(lambda_weight) AS avg_lambda
      FROM governance_envelope;
    `;
    const { rows } = await this.pool.query(sql);
    return rows[0] || null;
  }
}
