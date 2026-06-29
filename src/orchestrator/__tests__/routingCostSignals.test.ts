/**
 * Routing Cost Signals Tests
 * Verify MAAL routing bias tiers based on cost/savings
 */

import { getRoutingSignals, getAllRoutingSignals, type RoutingSignal } from '../routingCostSignals';
import * as CostReport from '../../lib/report/CicCostComputeReport';

describe('RoutingCostSignals', () => {
  // Mock report generator
  const mockReport = (
    agentCostPerDay: number,
    agentSavingsPerDay: number,
    agent = 'test-agent'
  ): CostReport.CicCostComputeReport => ({
    usage: { dailyTokens: 1000, weeklyTokens: 7000, dailyProjection: 30000 },
    cost: { dailyCost: 0.5, weeklyCost: 3.5, dailyProjection: 15.0 },
    local: {
      dailySavings: agentSavingsPerDay,
      weeklySavings: agentSavingsPerDay * 7,
      gpuCostPerDay: 1.5,
      roi: agentSavingsPerDay / 1.5,
    },
    agents: {
      burn: {
        [agent]: { tokens: 1000, cost: agentCostPerDay },
      },
      savings: {
        [agent]: agentSavingsPerDay,
      },
    },
  });

  describe('Bias tier: strong local savings (> 1.00)', () => {
    it('should set +0.25 bias when localSavingsPerDay > 1.0', () => {
      const report = mockReport(5.0, 1.5); // cost=5, savings=1.5
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.localBias).toBe(0.25);
      expect(signal.preferLocal).toBe(true);
      expect(signal.reasoning).toContain('Strong local savings');
    });

    it('should prefer local model for high savings scenario', () => {
      const report = mockReport(10.0, 2.0);
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.localBias).toBe(0.25);
      expect(signal.preferLocal).toBe(true);
    });
  });

  describe('Bias tier: moderate local savings (0.25 < x <= 1.00)', () => {
    it('should set +0.10 bias when 0.25 < localSavingsPerDay <= 1.0', () => {
      const report = mockReport(3.0, 0.5); // cost=3, savings=0.5
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.localBias).toBe(0.1);
      expect(signal.preferLocal).toBe(true);
      expect(signal.reasoning).toContain('Moderate local savings');
    });

    it('should weakly prefer local at boundary (0.25 < savings < 1.0)', () => {
      const report = mockReport(2.0, 0.6);
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.localBias).toBe(0.1);
      expect(signal.preferLocal).toBe(true);
    });
  });

  describe('Bias tier: low local savings (< 0.25)', () => {
    it('should set 0 bias when localSavingsPerDay < 0.1', () => {
      const report = mockReport(1.0, 0.05); // cost=1, savings=0.05
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.localBias).toBe(0);
      expect(signal.preferLocal).toBe(false);
      expect(signal.reasoning).toContain('Low local savings');
    });

    it('should not prefer local when no savings', () => {
      const report = mockReport(1.0, 0.0);
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.localBias).toBe(0);
      expect(signal.preferLocal).toBe(false);
    });
  });

  describe('Agent burn spike scenario', () => {
    it('should detect high burn with zero local savings', () => {
      // High cost, zero savings → use cloud model
      const report = mockReport(15.0, 0.0);
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.costPerDay).toBe(15.0);
      expect(signal.localSavingsPerDay).toBe(0.0);
      expect(signal.localBias).toBe(0);
      expect(signal.preferLocal).toBe(false);
    });

    it('should react when agent burn changes from moderate to high', () => {
      const report1 = mockReport(2.0, 0.5);
      const report2 = mockReport(8.0, 0.5);

      const signal1 = getRoutingSignals('test-agent', report1);
      const signal2 = getRoutingSignals('test-agent', report2);

      // Bias stays same, but cost increased significantly
      expect(signal1.localBias).toBe(signal2.localBias); // both +0.1
      expect(signal2.costPerDay).toBeGreaterThan(signal1.costPerDay); // 8 > 2
    });
  });

  describe('getAllRoutingSignals', () => {
    it('should generate signals for all agents in report', () => {
      const report: CostReport.CicCostComputeReport = {
        usage: { dailyTokens: 2000, weeklyTokens: 14000, dailyProjection: 60000 },
        cost: { dailyCost: 1.0, weeklyCost: 7.0, dailyProjection: 30.0 },
        local: {
          dailySavings: 2.0,
          weeklySavings: 14.0,
          gpuCostPerDay: 1.5,
          roi: 1.33,
        },
        agents: {
          burn: {
            'agent-a': { tokens: 500, cost: 1.5 },
            'agent-b': { tokens: 800, cost: 2.0 },
            'agent-c': { tokens: 700, cost: 1.2 },
          },
          savings: {
            'agent-a': 0.8,
            'agent-b': 0.6,
            'agent-c': 0.1,
          },
        },
      };

      const signals = getAllRoutingSignals(report);

      expect(signals).toHaveLength(3);
      expect(signals.map(s => s.agent)).toContain('agent-a');
      expect(signals.map(s => s.agent)).toContain('agent-b');
      expect(signals.map(s => s.agent)).toContain('agent-c');
    });

    it('should rank agents by local bias', () => {
      const report: CostReport.CicCostComputeReport = {
        usage: { dailyTokens: 1500, weeklyTokens: 10500, dailyProjection: 45000 },
        cost: { dailyCost: 0.75, weeklyCost: 5.25, dailyProjection: 22.5 },
        local: {
          dailySavings: 1.5,
          weeklySavings: 10.5,
          gpuCostPerDay: 1.5,
          roi: 1.0,
        },
        agents: {
          burn: {
            'researcher': { tokens: 800, cost: 3.0 },
            'orchestrator': { tokens: 600, cost: 2.0 },
          },
          savings: {
            'researcher': 1.2, // > 1.0 → +0.25
            'orchestrator': 0.3, // > 0.25 → +0.10
          },
        },
      };

      const signals = getAllRoutingSignals(report);
      const sorted = signals.sort((a, b) => b.localBias - a.localBias);

      expect(sorted[0].agent).toBe('researcher');
      expect(sorted[0].localBias).toBe(0.25);
      expect(sorted[1].agent).toBe('orchestrator');
      expect(sorted[1].localBias).toBe(0.1);
    });
  });

  describe('Edge cases', () => {
    it('should handle agent with no burn data', () => {
      const report = mockReport(0, 0);
      // Manually set a different agent
      report.agents.burn['nonexistent'] = { tokens: 0, cost: 0 };
      report.agents.savings['nonexistent'] = 0;

      const signal = getRoutingSignals('nonexistent', report);

      expect(signal.agent).toBe('nonexistent');
      expect(signal.costPerDay).toBe(0);
      expect(signal.localBias).toBe(0);
    });

    it('should boundary-test at bias tier thresholds', () => {
      // Test exactly at 0.25 boundary (should be 0, not 0.1)
      const report = mockReport(1.0, 0.25);
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.localBias).toBe(0); // 0.25 is NOT > 0.25
    });

    it('should boundary-test at 1.0 threshold', () => {
      // Test exactly at 1.0 boundary (should be 0.1, not 0.25)
      const report = mockReport(2.0, 1.0);
      const signal = getRoutingSignals('test-agent', report);

      expect(signal.localBias).toBe(0.1); // 1.0 is NOT > 1.0
    });
  });
});
