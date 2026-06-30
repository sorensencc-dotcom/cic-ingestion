import { Pool } from 'pg';
import * as http from 'http';

export class PrometheusExporter {
  constructor(
    private readonly pool: Pool,
    private readonly port: number = 9100
  ) {}

  start(): http.Server {
    const server = http.createServer(async (req, res) => {
      if (req.url !== '/metrics') {
        res.statusCode = 404;
        res.end('404 Not Found');
        return;
      }

      try {
        const metrics = await this.fetchLatestNightlyMetrics();
        const body = this.renderPrometheus(metrics);

        res.setHeader('Content-Type', 'text/plain; version=0.0.4');
        res.end(body);
      } catch (err) {
        console.error('[PrometheusExporter] Error:', err);
        res.statusCode = 500;
        res.end('500 Internal Server Error');
      }
    });

    server.listen(this.port, () => {
      console.log(`[PrometheusExporter] Listening on port ${this.port}`);
    });

    return server;
  }

  private async fetchLatestNightlyMetrics(): Promise<any> {
    const { rows } = await this.pool.query(
      `SELECT * FROM nightly_metrics ORDER BY day DESC LIMIT 1`
    );
    return rows[0] || null;
  }

  private renderPrometheus(m: any): string {
    if (!m) {
      return '# No metrics available\n';
    }

    const lines = [
      `# HELP maal_violation_rate Violation rate per day`,
      `# TYPE maal_violation_rate gauge`,
      `maal_violation_rate ${m.violation_rate || 0}`,
      ``,
      `# HELP maal_rollback_severity_index Rollback severity index per day`,
      `# TYPE maal_rollback_severity_index gauge`,
      `maal_rollback_severity_index ${m.rollback_severity_index || 0}`,
      ``,
      `# HELP maal_cohort_stability_score Cohort stability score per day`,
      `# TYPE maal_cohort_stability_score gauge`,
      `maal_cohort_stability_score ${m.cohort_stability_score || 0}`,
      ``,
      `# HELP maal_impact_drift Impact drift per day`,
      `# TYPE maal_impact_drift gauge`,
      `maal_impact_drift ${m.impact_drift || 0}`,
      ``,
      `# HELP maal_governance_risk_score Average governance risk score`,
      `# TYPE maal_governance_risk_score gauge`,
      `maal_governance_risk_score ${m.avg_risk_score || 0}`,
      ``,
      `# HELP maal_governance_threshold Average governance threshold`,
      `# TYPE maal_governance_threshold gauge`,
      `maal_governance_threshold ${m.avg_threshold || 0}`,
      ``,
      `# HELP maal_governance_lambda Average lambda weight`,
      `# TYPE maal_governance_lambda gauge`,
      `maal_governance_lambda ${m.avg_lambda || 0}`,
      ``
    ];

    return lines.join('\n');
  }
}
