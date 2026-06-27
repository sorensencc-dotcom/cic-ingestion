import { Router, Request, Response } from "express";
import { AdapterIntegrationService } from "../services/AdapterIntegrationService";

export function createExecuteRouter(service: AdapterIntegrationService): Router {
  const router = Router();

  router.post("/:adapterName", async (req: Request, res: Response) => {
    try {
      const { adapterName } = req.params;
      const payload = req.body;

      const result = await service.execute(adapterName, payload);

      res.status(result.success ? 200 : 400).json({
        success: result.success,
        data: result.data,
        error: result.error,
        driftSignals: result.driftSignals,
        hydrationFailures: result.hydrationFailures,
        stats: result.stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post("/batch/:adapterName", async (req: Request, res: Response) => {
    try {
      const { adapterName } = req.params;
      const payloads = Array.isArray(req.body) ? req.body : [req.body];

      const results = await service.executeBatch(adapterName, payloads);

      res.status(200).json({
        success: true,
        results,
        count: results.length,
        passed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get("/status", (req: Request, res: Response) => {
    const adapters = service.getRegisteredAdapters();
    const poolStats = service.getWarmPoolStats();

    res.json({
      healthy: true,
      adapters: Object.keys(adapters),
      warmPool: poolStats,
      timestamp: Date.now(),
    });
  });

  router.post("/invalidate", (req: Request, res: Response) => {
    try {
      const { key } = req.body;

      const count = service.invalidateWarmPool(key);

      res.json({
        success: true,
        invalidated: count,
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
