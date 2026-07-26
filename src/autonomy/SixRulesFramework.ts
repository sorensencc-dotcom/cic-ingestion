/**
 * Six Rules Framework — Barrel Export
 *
 * Central entry point for:
 * - CodeLevelDriftDetector (detects KS/WA/OP/RR)
 * - InstinctOps (pre-cognitive biases)
 * - ExecutionPolicyAutoHealing (plan recovery)
 */

export type {
  CodeLevelDriftDetector,
  DriftSignal,
  CodeLevelInput,
  PlanNode,
  CodeDiff,
  TestBundle,
  DependencyRecord,
} from '../drift/CodeLevelDriftDetector.js';

export { InstinctOps, getInstinctOps } from './InstinctOps.js';
export type { InstinctHook, InstinctContext, InstinctResult } from './InstinctOps.js';

export {
  ExecutionPolicyAutoHealing,
  getExecutionPolicyAutoHealing,
} from './ExecutionPolicyInterceptor.AutoHealing.js';
export type { HealingOutput } from './ExecutionPolicyInterceptor.AutoHealing.js';
