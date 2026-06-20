/**
 * Governance Router (Phase 5b)
 * Exposes governance/council voting through autonomy API
 * Routes all governance-related requests to the governance control plane
 */
import { Router } from 'express';
export function createGovernanceRouter(config) {
    const router = Router();
    // Governance control plane URL (defaults to Governance service)
    const governanceUrl = config?.governanceControlPlaneUrl || process.env.GOVERNANCE_URL || 'http://localhost:3113';
    /**
     * POST /governance/votes
     * Submit a proposal for council voting
     */
    router.post('/governance/votes', async (req, res, next) => {
        try {
            const response = await fetch(`${governanceUrl}/governance/votes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            if (!response.ok) {
                res.status(response.status).json({
                    error: 'Governance service error',
                    message: response.statusText,
                });
                return;
            }
            const data = await response.json();
            res.status(201).json(data);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * POST /governance/votes/:proposalId/vote
     * Record an individual council vote
     */
    router.post('/governance/votes/:proposalId/vote', async (req, res, next) => {
        try {
            const { proposalId } = req.params;
            const response = await fetch(`${governanceUrl}/governance/votes/${proposalId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            if (!response.ok) {
                res.status(response.status).json({
                    error: 'Governance service error',
                    message: response.statusText,
                });
                return;
            }
            const data = await response.json();
            res.status(201).json(data);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * POST /governance/decisions
     * Finalize governance decision
     */
    router.post('/governance/decisions', async (req, res, next) => {
        try {
            const response = await fetch(`${governanceUrl}/governance/decisions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
            });
            if (!response.ok) {
                res.status(response.status).json({
                    error: 'Governance service error',
                    message: response.statusText,
                });
                return;
            }
            const data = await response.json();
            res.status(201).json(data);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * GET /governance/log
     * Get governance decision log
     */
    router.get('/governance/log', async (req, res, next) => {
        try {
            const queryParams = new URLSearchParams(req.query).toString();
            const response = await fetch(`${governanceUrl}/governance/log?${queryParams}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                res.status(response.status).json({
                    error: 'Governance service error',
                    message: response.statusText,
                });
                return;
            }
            const data = await response.json();
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * GET /governance/queue
     * Get pending approval queue
     */
    router.get('/governance/queue', async (req, res, next) => {
        try {
            const response = await fetch(`${governanceUrl}/governance/queue`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                res.status(response.status).json({
                    error: 'Governance service error',
                    message: response.statusText,
                });
                return;
            }
            const data = await response.json();
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    });
    /**
     * GET /governance/proposal/:proposalId
     * Get specific proposal details
     */
    router.get('/governance/proposal/:proposalId', async (req, res, next) => {
        try {
            const { proposalId } = req.params;
            const response = await fetch(`${governanceUrl}/governance/proposal/${proposalId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                res.status(response.status).json({
                    error: 'Governance service error',
                    message: response.statusText,
                });
                return;
            }
            const data = await response.json();
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    });
    return router;
}
//# sourceMappingURL=governance.js.map