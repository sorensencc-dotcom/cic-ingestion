/**
 * Search Router (Phase 27.1)
 * Exposes TorqueQuery counterfactual reasoning through autonomy API
 */

import { Router, Request, Response, NextFunction } from 'express';
import { TorqueQueryClient } from '../../services/torquequery/TorqueQueryClient';
import type { CICQueryResponse } from '../../types/search';

export interface SearchRouterConfig {
  torqueQueryUrl?: string;
  governanceUrl?: string;
}

export function createSearchRouter(config?: SearchRouterConfig): Router {
  const router = Router();

  const torqueUrl = config?.torqueQueryUrl || process.env.MEMORY_STORE_URL || 'http://localhost:3110';
  const govUrl = config?.governanceUrl || process.env.GOVERNANCE_URL || 'http://localhost:3113';

  const torqueClient = new TorqueQueryClient({ url: torqueUrl });

  /**
   * POST /search/cic-query
   * Counterfactual reasoning over governance decisions
   */
  router.post('/search/cic-query', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query, phase_ids, confidence_min, limit } = req.body;

      const cicResults: CICQueryResponse = await torqueClient.cicQuery({
        query,
        phase_ids,
        confidence_min: confidence_min ?? 0.7,
        limit: limit ?? 20,
      });

      // Enrich with governance context if primary match exists
      if (cicResults.counterfactual_analysis?.primary_match) {
        try {
          const govResponse = await fetch(
            `${govUrl}/governance/decisions/${cicResults.counterfactual_analysis.primary_match}`,
            { method: 'GET' },
          );
          if (govResponse.ok) {
            const fullDecision = await govResponse.json();
            (cicResults.counterfactual_analysis as any).decision_details = fullDecision;
          }
        } catch (err) {
          // Governance enrichment optional; continue without it
        }
      }

      res.json(cicResults);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
