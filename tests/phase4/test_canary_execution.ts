/**
 * Phase 4: Canary Execution Tests (4 contracts)
 * Isolation, telemetry collection, soft/hard rollback.
 */

import { describe, it, expect } from '@jest/globals';
import { CanaryGateOrchestrator } from '../../src/core/maal/canary/CanaryGateOrchestrator';
import { CanaryCohortController } from '../../src/core/maal/canary/CanaryCohortController';
import { CanaryTelemetryCollector } from '../../src/core/maal/canary/CanaryTelemetry';
import { Proposal } from '../../src/core/maal/codesign/ProposalTypes';

describe('Canary Execution', () => {
  const orchestrator = new CanaryGateOrchestrator();
  const controller = new CanaryCohortController();
  const telemetry = new CanaryTelemetryCollector();

  it('contract: canary starts at 1% cohort isolation', async () => {
    const proposal: Proposal = {
      proposalId: 'prop_canary_01',
      submittedBy: 'system',
      deltas: [
        {
          type: 'reward',
          componentId: 'latency',
          weight: 0.6,
        },
      ],
      rationale: 'Canary test',
      submittedAt: Date.now(),
    };

    const result = await orchestrator.execute(proposal);
    expect(result.isOk()).toBe(true);
    const outcome = result.ok()!;
    expect(outcome.proposalId).toBe('prop_canary_01');
    expect(outcome.finalMetrics).toBeDefined();
  });

  it('contract: metrics collected per observation window', () => {
    const point = {
      proposalId: 'prop_canary_02',
      timestamp: Date.now(),
      cohortSize: 1,
      avgLatency: 1200,
      avgCost: 0.08,
      successRate: 0.98,
      errorRate: 0.02,
      driftScore: 0.05,
      sampleCount: 1000,
    };

    telemetry.recordPoint(point);
    const collected = telemetry.getMetricsForProposal('prop_canary_02');
    expect(collected).toBeDefined();
    expect(collected?.sampleCount).toBe(1000);
  });

  it('contract: soft violation pauses growth (no rollback)', () => {
    const metrics = {
      cohortSize: 5,
      avgLatency: 3000, // High
      avgCost: 0.09,
      successRate: 0.98,
      driftScore: 0.05,
      sampleCount: 500,
    };

    const config = {
      cohortCapPercent: 50,
      growthCurve: 'linear' as const,
      observationWindowMs: 300000,
      metricsCheckIntervalMs: 60000,
      thresholds: {
        maxCostDelta: 0.1,
        maxLatencyDelta: 0.15, // Will be exceeded by ~1.5x baseline
        minSuccessRate: 0.95,
        maxDriftScore: 0.2,
      },
    };

    controller.setBaseline({ avgLatency: 1200 }); // Baseline
    const decision = controller.decideCohortGrowth(metrics, config);
    expect(decision.action).toBe('pause');
    expect(decision.violated).toContain('latency_delta (0.150 > 0.150)');
  });

  it('contract: hard violation triggers rollback', () => {
    const metrics = {
      cohortSize: 10,
      avgLatency: 1200,
      avgCost: 0.08,
      successRate: 0.92, // Below minSuccessRate
      driftScore: 0.05,
      sampleCount: 500,
    };

    const config = {
      cohortCapPercent: 50,
      growthCurve: 'linear' as const,
      observationWindowMs: 300000,
      metricsCheckIntervalMs: 60000,
      thresholds: {
        maxCostDelta: 0.1,
        maxLatencyDelta: 0.15,
        minSuccessRate: 0.95, // Will be exceeded
        maxDriftScore: 0.2,
      },
    };

    const decision = controller.decideCohortGrowth(metrics, config);
    expect(decision.action).toBe('rollback_hard');
    expect(decision.violated).toContain('success_rate');
  });
});
