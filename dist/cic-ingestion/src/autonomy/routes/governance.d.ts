/**
 * Governance Router (Phase 5b)
 * Exposes governance/council voting through autonomy API
 * Routes all governance-related requests to the governance control plane
 */
import { Router } from 'express';
export interface GovernanceRouterConfig {
    governanceControlPlaneUrl?: string;
}
export declare function createGovernanceRouter(config?: GovernanceRouterConfig): Router;
//# sourceMappingURL=governance.d.ts.map