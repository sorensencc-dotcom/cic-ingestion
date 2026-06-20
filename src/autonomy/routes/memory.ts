/**
 * Memory Router (Phase 5b)
 * Exposes memory store queries through autonomy API
 * Routes all memory-related queries to the memory backend
 */

import { Router, Request, Response, NextFunction } from 'express';

export interface MemoryRouterConfig {
  memoryStoreUrl?: string;
}

export function createMemoryRouter(config?: MemoryRouterConfig): Router {
  const router = Router();

  // Memory store URL (defaults to localhost for Docker local development)
  const memoryStoreUrl = config?.memoryStoreUrl || process.env.MEMORY_STORE_URL || 'http://localhost:3110';

  /**
   * POST /memory/ingest
   * Ingest event into memory store
   */
  router.post('/memory/ingest', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await fetch(`${memoryStoreUrl}/memory/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: 'Memory store error',
          message: response.statusText,
        });
        return;
      }

      const data = await response.json();
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /memory/ingest-batch
   * Ingest multiple events into memory store
   */
  router.post('/memory/ingest-batch', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await fetch(`${memoryStoreUrl}/memory/ingest-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: 'Memory store error',
          message: response.statusText,
        });
        return;
      }

      const data = await response.json();
      res.status(201).json(data);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /memory/search
   * Search memory store
   */
  router.get('/memory/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
      const response = await fetch(`${memoryStoreUrl}/memory/search?${queryParams}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: 'Memory store error',
          message: response.statusText,
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /memory/by-type/:type
   * Query memory by event type
   */
  router.get('/memory/by-type/:type', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params;
      const response = await fetch(`${memoryStoreUrl}/memory/by-type/${type}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: 'Memory store error',
          message: response.statusText,
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /memory/by-agent/:agentId
   * Query memory by agent ID
   */
  router.get('/memory/by-agent/:agentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const response = await fetch(`${memoryStoreUrl}/memory/by-agent/${agentId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: 'Memory store error',
          message: response.statusText,
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /memory/by-correlation/:correlationId
   * Query memory by correlation ID
   */
  router.get('/memory/by-correlation/:correlationId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { correlationId } = req.params;
      const response = await fetch(`${memoryStoreUrl}/memory/by-correlation/${correlationId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        res.status(response.status).json({
          error: 'Memory store error',
          message: response.statusText,
        });
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
