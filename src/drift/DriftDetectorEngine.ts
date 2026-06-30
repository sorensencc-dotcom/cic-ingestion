import { Pool } from 'pg';

export interface DriftAlert {
  type: 'impact' | 'violation' | 'stability' | 'risk';
  severity: 'low' | 'medium' | 'high';
  message: string;
  day: string;
  value?: number;
  baseline?: number;
}

export class DriftDetectorEngine {
  constructor(private readonly pool: Pool) {}

  async evaluate(): Promise<DriftAlert[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM nightly_metrics ORDER BY day DESC LIMIT 14`
    );

    if (rows.length < 2) {
      return [];
    }

    const alerts: DriftAlert[] = [];
    const latest = rows[0];
    const recentMetrics = rows.slice(0, 7);
    const baselineMetrics = rows.slice(7);

    // Impact drift spike (1.5x baseline)
    if (baselineMetrics.length > 0) {
      const baseline = baselineMetrics.reduce((acc, r) => acc + Number(r.impact_drift), 0) / baselineMetrics.length;
      if (latest.impact_drift > baseline * 1.5) {
        alerts.push({
          type: 'impact',
          severity: 'high',
          message: `Impact drift spiked to ${latest.impact_drift.toFixed(4)} vs baseline ${baseline.toFixed(4)}`,
          day: latest.day,
          value: latest.impact_drift,
          baseline
        });
      }
    }

    // Violation rate spike (1.5x baseline)
    if (baselineMetrics.length > 0) {
      const vrBaseline = baselineMetrics.reduce((acc, r) => acc + Number(r.violation_rate), 0) / baselineMetrics.length;
      if (latest.violation_rate > vrBaseline * 1.5) {
        alerts.push({
          type: 'violation',
          severity: 'medium',
          message: `Violation rate increased to ${latest.violation_rate.toFixed(4)} vs baseline ${vrBaseline.toFixed(4)}`,
          day: latest.day,
          value: latest.violation_rate,
          baseline: vrBaseline
        });
      }
    }

    // Cohort stability drop (0.8x baseline)
    if (baselineMetrics.length > 0) {
      const cssBaseline = baselineMetrics.reduce((acc, r) => acc + Number(r.cohort_stability_score), 0) / baselineMetrics.length;
      if (latest.cohort_stability_score < cssBaseline * 0.8) {
        alerts.push({
          type: 'stability',
          severity: 'medium',
          message: `Cohort stability dropped to ${latest.cohort_stability_score.toFixed(4)} vs baseline ${cssBaseline.toFixed(4)}`,
          day: latest.day,
          value: latest.cohort_stability_score,
          baseline: cssBaseline
        });
      }
    }

    // Risk score rise (1.3x baseline)
    if (baselineMetrics.length > 0) {
      const rsBaseline = baselineMetrics.reduce((acc, r) => acc + Number(r.avg_risk_score), 0) / baselineMetrics.length;
      if (latest.avg_risk_score > rsBaseline * 1.3) {
        alerts.push({
          type: 'risk',
          severity: 'medium',
          message: `Governance risk increased to ${latest.avg_risk_score.toFixed(4)} vs baseline ${rsBaseline.toFixed(4)}`,
          day: latest.day,
          value: latest.avg_risk_score,
          baseline: rsBaseline
        });
      }
    }

    return alerts;
  }
}
