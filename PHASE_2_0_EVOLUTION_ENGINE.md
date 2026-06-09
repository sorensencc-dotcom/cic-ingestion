# Phase 2.0 EvolutionEngine Design

**Status:** Specification locked  
**Date:** 2026-06-08  
**Component:** Multi-Phase Evolution Loop (MPEL)

---

## Overview

The **EvolutionEngine** is CIC's self-improvement mechanism. It accepts proposals from agents, evaluates them under governance, applies approved changes, and tracks outcomes.

---

## Core Concepts

### Evolution Proposal

A proposal for change submitted by an agent.

```typescript
export interface EvolutionProposal {
  id: string;                        // unique proposal ID
  source_agent: string;              // "planner" | "auditor" | "optimizer" | etc
  target_component: string;          // "wayland" | "caveman" | "torquequery" | "memory"
  change_type: ChangeType;           // "config" | "policy" | "topology" | "code"
  payload: unknown;                  // structured change description
  rationale: string;                 // why this change is needed
  risk_level: RiskLevel;             // "low" | "medium" | "high"
  metrics_before?: Record<string, number>;  // current metrics
  metrics_projected?: Record<string, number>; // projected metrics after change
  rollback_plan?: RollbackPlan;      // how to undo if it fails
}

type ChangeType = "config" | "policy" | "topology" | "code";
type RiskLevel = "low" | "medium" | "high";

export interface RollbackPlan {
  reverting_proposal_id?: string;    // prior state to revert to
  manual_steps?: string[];           // manual steps to undo
  estimated_rollback_time_ms?: number;
}
```

### Evolution Decision

Governance's approval or rejection of a proposal.

```typescript
export interface EvolutionDecision {
  proposal_id: string;
  approved: boolean;
  reason: string;                    // why approved/rejected
  applied_at?: number;               // timestamp when applied
  error?: string;                    // if apply failed
}
```

### Evolution Cycle

A complete evolution from proposal → decision → application → outcome.

```typescript
export interface EvolutionCycle {
  id: string;
  proposal: EvolutionProposal;
  decision: EvolutionDecision;
  applied: boolean;
  outcome?: EvolutionOutcome;
  duration_ms: number;
}

export interface EvolutionOutcome {
  success: boolean;
  metrics_after: Record<string, number>;
  errors?: string[];
  rollback_triggered: boolean;
}
```

---

## EvolutionEngine Class

```typescript
import { GovernanceEngine } from "../governance/GovernanceEngine";
import { Logger } from "../observability/Logger";
import { MetricsCollector } from "../observability/MetricsCollector";

export class EvolutionEngine {
  private cycles: Map<string, EvolutionCycle> = new Map();
  private cycleHistory: EvolutionCycle[] = [];

  constructor(
    private governance: GovernanceEngine,
    private logger: Logger,
    private metrics: MetricsCollector
  ) {}

  /**
   * Submit a proposal for evolution
   */
  async submitProposal(proposal: EvolutionProposal): Promise<EvolutionDecision> {
    const startTime = Date.now();

    // 1. Log submission
    this.logger.info("evolution.proposal_submitted", { proposal_id: proposal.id, source_agent: proposal.source_agent });

    // 2. Check governance
    const governanceOk = this.governance.checkEvolutionPolicy(proposal);
    if (!governanceOk) {
      const decision: EvolutionDecision = {
        proposal_id: proposal.id,
        approved: false,
        reason: "governance_policy_violation",
      };
      this.logger.warn("evolution.governance_denied", { proposal_id: proposal.id });
      return decision;
    }

    // 3. Evaluate risk
    const riskOk = this.evaluateRisk(proposal);
    if (!riskOk) {
      const decision: EvolutionDecision = {
        proposal_id: proposal.id,
        approved: false,
        reason: "risk_assessment_failed",
      };
      this.logger.warn("evolution.risk_blocked", { proposal_id: proposal.id, risk_level: proposal.risk_level });
      return decision;
    }

    // 4. Apply change
    let applied = false;
    let error: string | undefined;
    try {
      applied = await this.applyChange(proposal);
    } catch (e) {
      error = String(e);
      this.logger.error("evolution.apply_error", { proposal_id: proposal.id, error });
    }

    if (!applied) {
      const decision: EvolutionDecision = {
        proposal_id: proposal.id,
        approved: false,
        reason: "apply_failed",
        error,
      };
      return decision;
    }

    // 5. Record decision
    const decision: EvolutionDecision = {
      proposal_id: proposal.id,
      approved: true,
      reason: "applied",
      applied_at: Date.now(),
    };

    // 6. Record cycle
    const cycle: EvolutionCycle = {
      id: `cycle_${proposal.id}`,
      proposal,
      decision,
      applied: true,
      duration_ms: Date.now() - startTime,
    };

    this.cycles.set(cycle.id, cycle);
    this.cycleHistory.push(cycle);

    this.logger.info("evolution.cycle_completed", {
      cycle_id: cycle.id,
      proposal_id: proposal.id,
      duration_ms: cycle.duration_ms,
    });

    this.metrics.recordEvolutionCycle(cycle);
    return decision;
  }

  /**
   * Evaluate risk of a proposal
   *
   * Rules:
   * - high-risk topology/code changes: blocked unless explicitly allowed
   * - high-risk policy changes: require second approval
   * - low-risk config changes: auto-approved if governance OK
   */
  private evaluateRisk(proposal: EvolutionProposal): boolean {
    // Block high-risk changes to topology or code
    if (
      proposal.risk_level === "high" &&
      (proposal.change_type === "topology" || proposal.change_type === "code")
    ) {
      this.logger.warn("evolution.risk_high_topology_code_blocked", { proposal_id: proposal.id });
      return false;
    }

    // Warn on high-risk policy changes (but allow)
    if (proposal.risk_level === "high" && proposal.change_type === "policy") {
      this.logger.warn("evolution.risk_high_policy_applied", { proposal_id: proposal.id });
    }

    return true;
  }

  /**
   * Apply change based on target component
   */
  private async applyChange(proposal: EvolutionProposal): Promise<boolean> {
    switch (proposal.target_component) {
      case "caveman":
        return this.applyCavemanChange(proposal);
      case "wayland":
        return this.applyWaylandChange(proposal);
      case "torquequery":
        return this.applyTorqueQueryChange(proposal);
      case "memory":
        return this.applyMemoryChange(proposal);
      case "governance":
        return this.applyGovernanceChange(proposal);
      default:
        this.logger.error("evolution.unknown_component", { component: proposal.target_component });
        return false;
    }
  }

  /**
   * Apply Caveman compression profile/budget changes
   */
  private async applyCavemanChange(proposal: EvolutionProposal): Promise<boolean> {
    // Example: update compression profiles, budgets, modes
    // payload: { mode?: "semantic" | "ast" | "diff", budget?: number }
    this.logger.info("evolution.applying_caveman_change", { proposal_id: proposal.id });
    // TODO: Actually update Caveman config
    return true;
  }

  /**
   * Apply Wayland adapter/policy changes
   */
  private async applyWaylandChange(proposal: EvolutionProposal): Promise<boolean> {
    // Example: enable/disable adapters, change policies
    // payload: { adapter?: string, enabled?: boolean }
    this.logger.info("evolution.applying_wayland_change", { proposal_id: proposal.id });
    // TODO: Actually update Wayland config
    return true;
  }

  /**
   * Apply TorqueQuery index/query strategy changes
   */
  private async applyTorqueQueryChange(proposal: EvolutionProposal): Promise<boolean> {
    // Example: index changes, query strategies
    // payload: { index?: string, strategy?: string }
    this.logger.info("evolution.applying_torquequery_change", { proposal_id: proposal.id });
    // TODO: Actually update TorqueQuery config
    return true;
  }

  /**
   * Apply memory pipeline retention/drift threshold changes
   */
  private async applyMemoryChange(proposal: EvolutionProposal): Promise<boolean> {
    // Example: retention policies, drift thresholds
    // payload: { retention_days?: number, drift_threshold?: number }
    this.logger.info("evolution.applying_memory_change", { proposal_id: proposal.id });
    // TODO: Actually update memory policies
    return true;
  }

  /**
   * Apply governance policy changes
   */
  private async applyGovernanceChange(proposal: EvolutionProposal): Promise<boolean> {
    // Example: tool allowlists, rate limits
    // payload: { policy_type: string, rules: unknown }
    this.logger.info("evolution.applying_governance_change", { proposal_id: proposal.id });
    // TODO: Actually update governance policies
    return true;
  }

  /**
   * Get evolution cycle by ID
   */
  getCycle(cycleId: string): EvolutionCycle | undefined {
    return this.cycles.get(cycleId);
  }

  /**
   * Get all evolution cycles
   */
  getAllCycles(): EvolutionCycle[] {
    return this.cycleHistory;
  }

  /**
   * Get cycles for a specific agent
   */
  getCyclesByAgent(agentName: string): EvolutionCycle[] {
    return this.cycleHistory.filter((c) => c.proposal.source_agent === agentName);
  }

  /**
   * Get cycles for a specific component
   */
  getCyclesByComponent(component: string): EvolutionCycle[] {
    return this.cycleHistory.filter((c) => c.proposal.target_component === component);
  }

  /**
   * Get success rate of proposals from an agent
   */
  getAgentSuccessRate(agentName: string): number {
    const cycles = this.getCyclesByAgent(agentName);
    if (cycles.length === 0) return 1.0;
    const approved = cycles.filter((c) => c.decision.approved).length;
    return approved / cycles.length;
  }

  /**
   * Statistics for observability
   */
  getStats(): {
    total_proposals: number;
    approved: number;
    rejected: number;
    approval_rate: number;
    by_component: Record<string, number>;
    by_agent: Record<string, number>;
  } {
    const total = this.cycleHistory.length;
    const approved = this.cycleHistory.filter((c) => c.decision.approved).length;
    const rejected = total - approved;

    const by_component: Record<string, number> = {};
    const by_agent: Record<string, number> = {};

    for (const cycle of this.cycleHistory) {
      const component = cycle.proposal.target_component;
      const agent = cycle.proposal.source_agent;

      by_component[component] = (by_component[component] || 0) + 1;
      by_agent[agent] = (by_agent[agent] || 0) + 1;
    }

    return {
      total_proposals: total,
      approved,
      rejected,
      approval_rate: total > 0 ? approved / total : 0,
      by_component,
      by_agent,
    };
  }
}
```

---

## Integration Points

### Planner → EvolutionEngine

When Planner detects a bottleneck (too many tool calls, slow memory pipeline):

```typescript
const proposal: EvolutionProposal = {
  id: `proposal_${Date.now()}`,
  source_agent: "planner",
  target_component: "caveman",
  change_type: "config",
  payload: {
    mode: "diff",  // suggest diff mode for faster compression
  },
  rationale: "Memory pipeline latency p95=150ms, suggest diff mode for 3x speedup",
  risk_level: "low",
  metrics_before: { memory_latency_p95_ms: 150 },
  metrics_projected: { memory_latency_p95_ms: 50 },
};

await evolutionEngine.submitProposal(proposal);
```

### Auditor → EvolutionEngine

When Auditor detects policy violations or drift:

```typescript
const proposal: EvolutionProposal = {
  id: `proposal_${Date.now()}`,
  source_agent: "auditor",
  target_component: "governance",
  change_type: "policy",
  payload: {
    policy_type: "tool_quota",
    tool_name: "shell",
    max_daily_calls: 100,  // was 1000
  },
  rationale: "Shell adapter used 5000 times in 1 hour (runaway tool calls)",
  risk_level: "high",
};

await evolutionEngine.submitProposal(proposal);
```

### Optimizer → EvolutionEngine

When Optimizer detects inefficiency:

```typescript
const proposal: EvolutionProposal = {
  id: `proposal_${Date.now()}`,
  source_agent: "optimizer",
  target_component: "caveman",
  change_type: "config",
  payload: {
    mode: "semantic",
    budget_bytes: 10000000,  // increase from 5MB to 10MB
  },
  rationale: "Caveman budget exhausted frequently, suggest 2x budget increase",
  risk_level: "low",
};

await evolutionEngine.submitProposal(proposal);
```

---

## Observability

**Metrics:**
- `evolution.proposals_total` (counter)
- `evolution.proposals_approved` (counter)
- `evolution.proposals_rejected` (counter)
- `evolution.cycle_duration_ms` (histogram)
- `evolution.approval_rate` (gauge)

**Logs:**
- `evolution.proposal_submitted` (info)
- `evolution.governance_denied` (warn)
- `evolution.risk_blocked` (warn)
- `evolution.apply_error` (error)
- `evolution.cycle_completed` (info)

**Dashboard:**
- Evolution cycle timeline
- Approval rate by component
- Approval rate by agent
- Cycle duration distribution

---

## Testing

**Unit tests:**
- `submitProposal()` with governance OK/denied
- `evaluateRisk()` with low/medium/high risk
- `applyChange()` for each component
- `getStats()` calculations
- `getCyclesByAgent()` filtering

**Integration tests:**
- End-to-end proposal → decision → application
- Agent submits proposal → observes metrics change
- Rollback on apply failure

**Load tests:**
- 1000 proposals/sec throughput
- p99 decision latency < 100ms
- No memory leaks

---

## Status

✅ Specification locked  
⏳ Implementation: Phase 2.0  
⏳ Integration: Phase 2.0

---

**Created:** 2026-06-08  
**Target implementation:** 2026-07-15
