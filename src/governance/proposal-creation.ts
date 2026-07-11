import { Proposal } from './proposal-validator';

/**
 * AuditRecord: Output from Phase 3 IngestionOrchestrator
 * Represents a successfully processed ingestion record with orchestration cost
 */
export interface AuditRecord {
  profile: string;
  lane: string;
  orchestration_cost: number;
  entry_id: string;
  created_at: string;
}

/**
 * APIEntry: External API entry for proposal creation
 */
export interface APIEntry {
  profile: string;
  lane: string;
  cost?: number;
  id?: string;
  timestamp?: string;
}

/**
 * ProposalCreation: Factory class to convert Phase 3 audit records
 * and API entries into Proposal objects for governance pipeline.
 *
 * Responsibilities:
 * - Extract profile, lane, cost from audit records
 * - Generate UUID for proposal_id
 * - Preserve lineage: entry_id → source_entry_id
 * - Pure function, no side effects
 */
export class ProposalCreation {
  /**
   * Create proposal from Phase 3 audit record
   * Extracts profile, lane, cost; generates proposal_id UUID; preserves entry_id lineage
   *
   * @param auditRecord Audit record from Phase 3 IngestionOrchestrator
   * @returns Proposal object ready for governance pipeline
   */
  fromAuditRecord(auditRecord: AuditRecord): Proposal {
    return {
      proposal_id: crypto.randomUUID(),
      source_entry_id: auditRecord.entry_id,
      profile: auditRecord.profile,
      lane: auditRecord.lane,
      orchestration_cost: auditRecord.orchestration_cost,
      created_at: auditRecord.created_at,
      version: '1.0.0',
    };
  }

  /**
   * Create proposal from API entry
   * Maps external API structure to Proposal with correct profile/lane
   *
   * @param apiEntry API entry
   * @returns Proposal object ready for governance pipeline
   */
  fromAPIEntry(apiEntry: APIEntry): Proposal {
    return {
      proposal_id: crypto.randomUUID(),
      source_entry_id: apiEntry.id || crypto.randomUUID(),
      profile: apiEntry.profile,
      lane: apiEntry.lane,
      orchestration_cost: apiEntry.cost || 0,
      created_at: apiEntry.timestamp || new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
