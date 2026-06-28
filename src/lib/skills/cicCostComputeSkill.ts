/**
 * CIC Cost Compute Skill
 * On-demand skill for accessing cost/usage/ROI analytics
 * Usable by agents via tool call
 */

import { generateCicCostComputeReport, type CicCostComputeReport } from '../report/CicCostComputeReport';
import { getAllRoutingSignals } from '../../orchestrator/routingCostSignals';

export type CostQueryType = 'summary' | 'agents' | 'roi' | 'routing' | 'env' | 'all';

export interface CicCostComputeSkillInput {
  query: CostQueryType;
}

export interface CicCostComputeSkillOutput {
  query: CostQueryType;
  timestamp: string;
  data: any;
}

/**
 * Main skill function
 * Returns typed slices of the unified cost report
 */
export async function cicCostComputeSkill(input: CicCostComputeSkillInput): Promise<CicCostComputeSkillOutput> {
  const report = generateCicCostComputeReport();

  let data: any;

  switch (input.query) {
    case 'summary':
      data = {
        dailyTokens: report.usage.dailyTokens,
        dailyCost: report.cost.dailyCost,
        weeklyCost: report.cost.weeklyCost,
        dailySavings: report.local.dailySavings,
        roi: report.local.roi,
      };
      break;

    case 'agents':
      data = {
        burn: report.agents.burn,
        savings: report.agents.savings,
      };
      break;

    case 'roi':
      data = {
        dailySavings: report.local.dailySavings,
        weeklySavings: report.local.weeklySavings,
        gpuCostPerDay: report.local.gpuCostPerDay,
        roi: report.local.roi,
      };
      break;

    case 'routing':
      const signals = getAllRoutingSignals(report);
      data = {
        signals,
        summary: signals.reduce(
          (acc, sig) => {
            acc.totalAgents += 1;
            if (sig.localBias > 0) acc.preferringLocal += 1;
            return acc;
          },
          { totalAgents: 0, preferringLocal: 0 }
        ),
      };
      break;

    case 'env':
      data = {
        daily: report.env?.daily,
        budget: report.budget,
      };
      break;

    case 'all':
      data = report;
      break;

    default:
      throw new Error(`Unknown query type: ${input.query}`);
  }

  return {
    query: input.query,
    timestamp: new Date().toISOString(),
    data,
  };
}

/**
 * Wrapper for tool calling
 * Entry point for agent framework
 */
export async function invokeSkill(query: CostQueryType): Promise<any> {
  const result = await cicCostComputeSkill({ query });
  return result.data;
}
