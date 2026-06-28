/**
 * Unified CIC Cost & Compute Report
 * Single source of truth for all cost/usage analytics
 */

import { UsageLedger, type DailySummary } from '../usage/UsageLedger.js';
import { getDailyGpuCost } from '../cost/GpuAmortization.js';

export interface CicCostComputeReport {
  usage: {
    dailyTokens: number;
    weeklyTokens: number;
    dailyProjection: number;
  };
  cost: {
    dailyCost: number;
    weeklyCost: number;
    dailyProjection: number;
  };
  local: {
    dailySavings: number;
    weeklySavings: number;
    gpuCostPerDay: number;
    roi: number;
  };
  agents: {
    burn: Record<string, { tokens: number; cost: number }>;
    savings: Record<string, number>;
  };
  env?: {
    daily: {
      dev: { tokens: number; cost: number };
      prod: { tokens: number; cost: number };
    };
  };
  budget?: {
    ema: number;
    alert: boolean;
    limit: number;
  };
}

export function generateCicCostComputeReport(): CicCostComputeReport {
  const summary = UsageLedger.getDailySummary();
  const projection = UsageLedger.getProjection(30);
  const gpuCost = getDailyGpuCost();

  // Agent burn (exclude savings)
  const agentBurn: Record<string, { tokens: number; cost: number }> = {};
  Object.entries(summary.byAgent).forEach(([agent, stats]) => {
    agentBurn[agent] = {
      tokens: stats.tokens,
      cost: stats.cost - stats.savings,
    };
  });

  // Agent savings
  const agentSavings: Record<string, number> = {};
  Object.entries(summary.byAgent).forEach(([agent, stats]) => {
    agentSavings[agent] = stats.savings;
  });

  // ROI calculation
  const roi = summary.dailySavings > 0 ? summary.dailySavings / gpuCost : 0;

  // Budget alerts (EMA-based)
  const dailyBudget = parseFloat(process.env.CIC_DAILY_BUDGET ?? '5.0');
  const budgetAlert = summary.emaCost > dailyBudget;

  return {
    usage: {
      dailyTokens: summary.dailyTokens,
      weeklyTokens: summary.weeklyTokens,
      dailyProjection: projection.tokens,
    },
    cost: {
      dailyCost: summary.dailyCost,
      weeklyCost: summary.weeklyCost,
      dailyProjection: projection.cost,
    },
    local: {
      dailySavings: summary.dailySavings,
      weeklySavings: summary.weeklySavings,
      gpuCostPerDay: gpuCost,
      roi,
    },
    agents: {
      burn: agentBurn,
      savings: agentSavings,
    },
    budget: {
      ema: summary.emaCost,
      alert: budgetAlert,
      limit: dailyBudget,
    },
  };
}
