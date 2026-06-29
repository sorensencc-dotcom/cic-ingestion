/**
 * Fire-Drill Router (D-Phase)
 * Resilience testing endpoints for MAAL routing layer
 * POST /autonomy/firedrills/run → Execute all 6 fire-drills
 * GET /autonomy/firedrills/report → Last fire-drill report
 * GET /autonomy/firedrills/health → Current health status
 */

import { Router, Request, Response } from "express";
import { FireDrillManager, FireDrillConfig } from "../FireDrillManager.js";

let fireDrillManager: FireDrillManager | null = null;

export function getFireDrillManager(): FireDrillManager {
  if (!fireDrillManager) {
    fireDrillManager = new FireDrillManager({
      enabled: true,
      reportToSLO: true,
      failureThreshold: 100
    });
  }
  return fireDrillManager;
}

export function createFireDrillRouter(): Router {
  const router = Router();
  const manager = getFireDrillManager();

  /**
   * POST /autonomy/firedrills/run
   * Execute fire-drill harness (all 6 failure modes)
   * Blocks until complete, returns report
   */
  router.post("/firedrills/run", async (req: Request, res: Response) => {
    try {
      const report = await manager.runDrills();

      res.json({
        success: report.healthy,
        report: {
          timestamp: report.timestamp.toISOString(),
          totalDrills: report.totalDrills,
          passedDrills: report.passedDrills,
          failedDrills: report.failedDrills,
          passRate: report.passRate,
          healthy: report.healthy,
          violations: report.violations.length > 0
            ? report.violations.map((v) => ({
                name: v.name,
                mode: v.mode,
                error: v.error
              }))
            : []
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: "Fire-drill execution failed",
        message: error.message
      });
    }
  });

  /**
   * GET /autonomy/firedrills/report
   * Retrieve last fire-drill report
   */
  router.get("/firedrills/report", (req: Request, res: Response) => {
    const report = manager.getLastReport();

    if (!report) {
      return res.status(404).json({
        error: "No fire-drill report available",
        message: "Run POST /autonomy/firedrills/run first"
      });
    }

    res.json({
      timestamp: report.timestamp.toISOString(),
      totalDrills: report.totalDrills,
      passedDrills: report.passedDrills,
      failedDrills: report.failedDrills,
      passRate: report.passRate,
      healthy: report.healthy,
      violations: report.violations.length > 0
        ? report.violations.map((v) => ({
            name: v.name,
            mode: v.mode,
            error: v.error
          }))
        : []
    });
  });

  /**
   * GET /autonomy/firedrills/health
   * Quick health check (0ms) based on last report
   */
  router.get("/firedrills/health", (req: Request, res: Response) => {
    const healthy = manager.isHealthy();

    res.json({
      healthy,
      status: healthy ? "ready" : "degraded",
      lastReportAt: manager.getLastReport()?.timestamp.toISOString() || null
    });
  });

  /**
   * POST /autonomy/firedrills/schedule
   * Start periodic fire-drill execution
   * Body: { intervalMs: number }
   */
  router.post("/firedrills/schedule", (req: Request, res: Response) => {
    try {
      const { intervalMs } = req.body;

      if (!intervalMs || intervalMs < 60000) {
        return res.status(400).json({
          error: "Invalid interval",
          message: "intervalMs must be >= 60000 (1 minute)"
        });
      }

      manager.startSchedule(intervalMs);

      res.json({
        scheduled: true,
        intervalMs,
        message: `Fire-drills will run every ${Math.round(intervalMs / 1000)}s`
      });
    } catch (error: any) {
      res.status(500).json({
        error: "Failed to schedule fire-drills",
        message: error.message
      });
    }
  });

  /**
   * POST /autonomy/firedrills/unschedule
   * Stop periodic fire-drill execution
   */
  router.post("/firedrills/unschedule", (req: Request, res: Response) => {
    try {
      manager.stopSchedule();
      res.json({
        unscheduled: true,
        message: "Fire-drill schedule stopped"
      });
    } catch (error: any) {
      res.status(500).json({
        error: "Failed to unschedule fire-drills",
        message: error.message
      });
    }
  });

  return router;
}
