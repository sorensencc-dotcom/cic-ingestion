/**
 * Test Fixtures for Bridge Tests
 * Mock signal and proposal generators
 */
import { AutonomySignal, DriftSignal, InstabilitySignal, RegressionSignal, OpportunitySignal } from '../../models/AutonomySignal';
import { RoadmapProposal } from '../../models/RoadmapProposal';
import { TimelineEvent } from '../../../ui/models/TimelineEvent';
/**
 * Create mock drift signal
 */
export declare function createMockDriftSignal(severity?: 'info' | 'warning' | 'critical'): DriftSignal;
/**
 * Create mock instability signal
 */
export declare function createMockInstabilitySignal(severity?: 'info' | 'warning' | 'critical'): InstabilitySignal;
/**
 * Create mock regression signal
 */
export declare function createMockRegressionSignal(severity?: 'info' | 'warning' | 'critical'): RegressionSignal;
/**
 * Create mock opportunity signal
 */
export declare function createMockOpportunitySignal(): OpportunitySignal;
/**
 * Create mock timeline event
 */
export declare function createMockTimelineEvent(type?: 'ARPS_DELTA' | 'PIPELINE_RUN' | 'GOVERNANCE_SIGNAL' | 'APR_PLAN' | 'CRO_RUN'): TimelineEvent;
/**
 * Create mock proposal
 */
export declare function createMockProposal(status?: 'pending' | 'approved' | 'rejected' | 'executed'): RoadmapProposal;
/**
 * Create mock proposal with multiple actions
 */
export declare function createMockProposalWithMultipleActions(): RoadmapProposal;
/**
 * Create mock approved proposal
 */
export declare function createMockApprovedProposal(): RoadmapProposal;
/**
 * Create multiple mock signals
 */
export declare function createMockSignals(count?: number): AutonomySignal[];
/**
 * Create multiple mock proposals
 */
export declare function createMockProposals(count?: number): RoadmapProposal[];
//# sourceMappingURL=fixtures.d.ts.map