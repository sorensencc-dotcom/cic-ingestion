import { CanaryResult } from './canary-engine';

/**
 * GovernanceLogEntry: Immutable record of a proposal's journey through Phase 4 governance
 * - proposal_id: unique identifier for proposal
 * - phase: always 4 for Wave B
 * - timestamp: when this decision was recorded
 * - governance_decision: 'approved' or 'rejected'
 * - canary_result: optional canary metrics if governance approved
 * - heal_decision: promotion outcome ('promote', 'rollback', 'hold')
 * - reason: human-readable reason for decision
 * - carried_to_phase: next phase (5 for promote, 4 for rollback/hold)
 */
export interface GovernanceLogEntry {
  proposal_id: string;
  phase: number;
  timestamp: Date;
  governance_decision: 'approved' | 'rejected';
  canary_result?: CanaryResult;
  heal_decision: 'promote' | 'rollback' | 'hold';
  reason: string;
  carried_to_phase: number;
}

/**
 * CostDistribution: P50, P75, P95 percentiles of orchestration costs
 */
export interface CostDistribution {
  p50: number;
  p75: number;
  p95: number;
}

/**
 * GovernanceLog: Immutable audit trail for Phase 4 governance decisions
 *
 * - Append-only: no updates/deletes
 * - O(1) lookup by proposal_id
 * - Tracks metrics: approval_rate, cost_distribution
 * - No state leakage between proposals
 */
export class GovernanceLog {
  private entries: Map<string, GovernanceLogEntry> = new Map();
  private entryList: GovernanceLogEntry[] = [];

  /**
   * Record a governance decision (immutable append)
   *
   * @param entry Complete governance log entry
   */
  record(entry: GovernanceLogEntry): void {
    // Freeze entry to ensure immutability
    Object.freeze(entry);
    if (entry.timestamp) {
      Object.freeze(entry.timestamp);
    }

    this.entries.set(entry.proposal_id, entry);
    this.entryList.push(entry);
  }

  /**
   * Get all entries in order (append-only sequence)
   *
   * @returns Read-only array of all entries
   */
  getEntries(): readonly GovernanceLogEntry[] {
    return Object.freeze([...this.entryList]);
  }

  /**
   * Look up entry by proposal_id (O(1))
   *
   * @param proposalId Proposal identifier
   * @returns Entry if found, undefined otherwise
   */
  getEntry(proposalId: string): GovernanceLogEntry | undefined {
    return this.entries.get(proposalId);
  }

  /**
   * Calculate approval rate: approved / total
   * Returns 0 if no entries
   *
   * @returns Number in range [0, 1]
   */
  getApprovalRate(): number {
    if (this.entryList.length === 0) return 0;

    const approvedCount = this.entryList.filter(
      (e) => e.governance_decision === 'approved'
    ).length;

    return approvedCount / this.entryList.length;
  }

  /**
   * Calculate cost distribution (P50, P75, P95) across all entries
   * Uses orchestration_cost from entries
   *
   * @returns CostDistribution with p50, p75, p95 percentiles
   */
  getCostDistribution(): CostDistribution {
    if (this.entryList.length === 0) {
      return { p50: 0, p75: 0, p95: 0 };
    }

    // Extract costs from entries
    const costs = this.entryList
      .map((e) => {
        // Costs are embedded in canary_result or available from context
        // For now, we'll use a simple extraction; in real use, costs would
        // be stored on the entry or parent record
        return 0; // Placeholder - will be enhanced in integration
      })
      .sort((a, b) => a - b);

    // Calculate percentiles
    const p50Index = Math.ceil(costs.length * 0.5) - 1;
    const p75Index = Math.ceil(costs.length * 0.75) - 1;
    const p95Index = Math.ceil(costs.length * 0.95) - 1;

    return {
      p50: costs[Math.max(0, p50Index)] || 0,
      p75: costs[Math.max(0, p75Index)] || 0,
      p95: costs[Math.max(0, p95Index)] || 0,
    };
  }

  /**
   * Get total number of entries
   *
   * @returns Entry count
   */
  size(): number {
    return this.entryList.length;
  }

  /**
   * Clear all entries (for testing only)
   */
  clear(): void {
    this.entries.clear();
    this.entryList = [];
  }
}
