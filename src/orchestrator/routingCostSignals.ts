/**
 * Routing Cost Signals
 * MAAL routing bias calculation based on cost/savings data
 */

import { generateCicCostComputeReport, type CicCostComputeReport } from '../lib/report/CicCostComputeReport.js';

export interface RoutingSignal {
  agent: string;
  costPerDay: number;
  localSavingsPerDay: number;
  localBias: number; // 0 = no bias, +0.25 or +0.10 = prefer local
  preferLocal: boolean;
  reasoning: string;
}

/**
 * Get routing signals for an agent based on cost/savings data
 * Bias tiers:
 *   localSavingsPerDay > 1.00 → +0.25 (strong local preference)
 *   localSavingsPerDay > 0.25 → +0.10 (weak local preference)
 *   else → 0 (no preference)
 */
export function getRoutingSignals(agent: string, report?: CicCostComputeReport): RoutingSignal {
  const rep = report || generateCicCostComputeReport();

  const agentBurn = rep.agents.burn[agent] || { tokens: 0, cost: 0 };
  const costPerDay = agentBurn.cost;

  const agentSavings = rep.agents.savings[agent] || 0;
  const localSavingsPerDay = agentSavings; // per-agent daily savings

  let localBias = 0;
  let reasoning = '';

  if (localSavingsPerDay > 1.0) {
    localBias = 0.25;
    reasoning = `Strong local savings (>${localSavingsPerDay.toFixed(2)}/day): prefer local model`;
  } else if (localSavingsPerDay > 0.25) {
    localBias = 0.1;
    reasoning = `Moderate local savings (>${localSavingsPerDay.toFixed(2)}/day): weak local preference`;
  } else {
    localBias = 0;
    reasoning = `Low local savings (<${localSavingsPerDay.toFixed(2)}/day): no preference`;
  }

  const preferLocal = localBias > 0;

  return {
    agent,
    costPerDay,
    localSavingsPerDay,
    localBias,
    preferLocal,
    reasoning,
  };
}

/**
 * Get all agent routing signals
 */
export function getAllRoutingSignals(report?: CicCostComputeReport): RoutingSignal[] {
  const rep = report || generateCicCostComputeReport();
  const agents = Object.keys(rep.agents.burn);
  return agents.map(agent => getRoutingSignals(agent, rep));
}
