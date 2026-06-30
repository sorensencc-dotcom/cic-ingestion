import { Pool } from 'pg';

export interface GovernanceEnvelope {
  proposal_id: string;
  current_version: string;
  previous_version: string;
  lineage_depth: number;
  last_violation: any | null;
  last_rollback: any | null;
  risk_score: number;
  hybrid_threshold: number;
  lambda_weight: number;
  updated_at: Date;
}

export class GovernanceEnvelopeCache {
  private cache = new Map<string, GovernanceEnvelope>();

  constructor(private readonly pool: Pool) {}

  async loadEnvelope(proposalId: string): Promise<GovernanceEnvelope | null> {
    if (this.cache.has(proposalId)) {
      return this.cache.get(proposalId)!;
    }

    const { rows } = await this.pool.query(
      `SELECT * FROM governance_envelope WHERE proposal_id = $1`,
      [proposalId]
    );

    if (!rows.length) return null;

    const row = rows[0];
    const env: GovernanceEnvelope = {
      proposal_id: row.proposal_id,
      current_version: row.current_version,
      previous_version: row.previous_version,
      lineage_depth: row.lineage_depth,
      last_violation: row.last_violation,
      last_rollback: row.last_rollback,
      risk_score: Number(row.risk_score),
      hybrid_threshold: Number(row.hybrid_threshold),
      lambda_weight: Number(row.lambda_weight),
      updated_at: row.updated_at
    };

    this.cache.set(proposalId, env);
    return env;
  }

  async refreshEnvelope(proposalId: string): Promise<GovernanceEnvelope | null> {
    this.cache.delete(proposalId);
    return this.loadEnvelope(proposalId);
  }

  async getAllEnvelopes(): Promise<GovernanceEnvelope[]> {
    const { rows } = await this.pool.query(`SELECT * FROM governance_envelope`);
    return rows.map(row => ({
      proposal_id: row.proposal_id,
      current_version: row.current_version,
      previous_version: row.previous_version,
      lineage_depth: row.lineage_depth,
      last_violation: row.last_violation,
      last_rollback: row.last_rollback,
      risk_score: Number(row.risk_score),
      hybrid_threshold: Number(row.hybrid_threshold),
      lambda_weight: Number(row.lambda_weight),
      updated_at: row.updated_at
    }));
  }

  async upsertEnvelope(env: Partial<GovernanceEnvelope> & { proposal_id: string }): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO governance_envelope (
        proposal_id, current_version, previous_version, lineage_depth,
        last_violation, last_rollback, risk_score, hybrid_threshold, lambda_weight
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (proposal_id) DO UPDATE SET
        current_version = EXCLUDED.current_version,
        previous_version = EXCLUDED.previous_version,
        lineage_depth = EXCLUDED.lineage_depth,
        last_violation = EXCLUDED.last_violation,
        last_rollback = EXCLUDED.last_rollback,
        risk_score = EXCLUDED.risk_score,
        hybrid_threshold = EXCLUDED.hybrid_threshold,
        lambda_weight = EXCLUDED.lambda_weight,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        env.proposal_id,
        env.current_version || '',
        env.previous_version || '',
        env.lineage_depth || 1,
        env.last_violation || null,
        env.last_rollback || null,
        env.risk_score || 0,
        env.hybrid_threshold || 0.30,
        env.lambda_weight || 0.37
      ]
    );

    this.cache.delete(env.proposal_id);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
