/**
 * Autonomy Learner Routes (Phase 23.7.7)
 * GET /autonomy/learner/metrics — learning metrics
 * GET /autonomy/learner/thresholds — current thresholds
 * POST /autonomy/learner/feedback — record proposal outcome
 * POST /autonomy/learner/decay — decay old signals
 */
import { Router } from 'express';
import { AutonomyLearner } from '../AutonomyLearner';
export declare function createLearnerRouter(learner: AutonomyLearner): Router;
//# sourceMappingURL=learner.d.ts.map