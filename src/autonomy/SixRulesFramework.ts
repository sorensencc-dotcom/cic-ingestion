/**
 * Six Rules Framework — Barrel Export
 *
 * Central entry point for:
 * - CodeLevelDriftDetector (detects KS/WA/OP/RR)
 * - InstinctOps (pre-cognitive biases)
 * - ExecutionPolicyAutoHealing (plan recovery)
 */

export {
  CodeLevelDriftDetector,
  DriftSignal,
  CodeLevelInput,
  PlanNode,
  CodeDiff,
  TestBundle,
  DependencyRecord,
} from '../drift/CodeLevelDriftDetector.js';

export { InstinctOps, InstinctHook, InstinctContext, InstinctResult, getInstinctOps } from './InstinctOps.js';

export {
  ExecutionPolicyAutoHealing,
  HealingOutput,
  getExecutionPolicyAutoHealing,
} from './ExecutionPolicyInterceptor.AutoHealing.js';
