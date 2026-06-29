/**
 * Phase 4: GlobalRoutingBounds — read-only Phase 1/2 thresholds.
 * Import-only. Never modify. CI gate rule 5.
 */

export interface GlobalRoutingBounds {
  readonly maxCostPerTask: number;
  readonly maxLatencyPerTask: number;
  readonly maxTotalCost: number;
  readonly maxTotalLatency: number;
}

// Placeholder: populated from Phase 1 ConstraintEngine
export const GLOBAL_ROUTING_BOUNDS: GlobalRoutingBounds = {
  maxCostPerTask: 0.10,
  maxLatencyPerTask: 5000, // ms
  maxTotalCost: 1000.0,
  maxTotalLatency: 300000, // 5 min
};
