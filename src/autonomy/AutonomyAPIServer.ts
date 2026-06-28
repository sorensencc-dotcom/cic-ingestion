/**
 * CIC Autonomy API Server
 * Express server exposing autonomy + execution + fire-drill endpoints
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cron from "node-cron";
import { createExecutionRouter } from "./routes/execution.js";
import { createFireDrillRouter } from "./routes/firedrills.js";
import { UsageLedger } from "../lib/usage/UsageLedger.js";
import { generateCicCostComputeReport } from "../lib/report/CicCostComputeReport.js";

export interface AutonomyAPIServerConfig {
  port?: number;
  host?: string;
  memoryQueryApiUrl?: string;
  roadmapContext?: any;
}

export class AutonomyAPIServer {
  private app: Express;
  private config: AutonomyAPIServerConfig;
  private server: any = null;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor(config: AutonomyAPIServerConfig = {}) {
    this.config = {
      port: 3000,
      host: "localhost",
      ...config,
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandler();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: "10mb" }));

    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (req: Request, res: Response) => {
      return res.json({
        status: "ok",
        service: "cic-autonomy-api",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    // API info
    this.app.get("/autonomy", (req: Request, res: Response) => {
      return res.json({
        service: "CIC Autonomy API",
        version: "1.0.0",
        endpoints: {
          execution: {
            "POST /autonomy/execution/register": "Register execution context",
            "GET /autonomy/execution/status/:taskId": "Get task status",
            "GET /autonomy/execution/audit/:taskId": "Get audit trail",
            "POST /autonomy/execution/check": "Check if tool is allowed",
            "GET /autonomy/execution/modes": "List execution modes",
          },
          firedrills: {
            "POST /autonomy/firedrills/run": "Execute all 6 fire-drills",
            "GET /autonomy/firedrills/report": "Get last fire-drill report",
            "GET /autonomy/firedrills/health": "Quick health check",
            "POST /autonomy/firedrills/schedule": "Schedule periodic runs",
            "POST /autonomy/firedrills/unschedule": "Stop periodic runs",
          },
        },
      });
    });

    // Cost tracking routes
    this.app.get("/api/usage-summary", (req: Request, res: Response) => {
      return res.json(UsageLedger.getDailySummary());
    });

    this.app.get("/api/agent-burn", (req: Request, res: Response) => {
      const report = generateCicCostComputeReport();
      return res.json(report.agents.burn);
    });

    this.app.get("/api/local-roi", (req: Request, res: Response) => {
      const report = generateCicCostComputeReport();
      return res.json(report.local);
    });

    this.app.get("/api/usage-summary-env", (req: Request, res: Response) => {
      const report = generateCicCostComputeReport();
      return res.json({
        dev: report.env?.daily?.dev,
        prod: report.env?.daily?.prod,
        budget: report.budget,
      });
    });

    // Mount routers
    const executionRouter = createExecutionRouter();
    const fireDrillRouter = createFireDrillRouter();

    this.app.use("/autonomy", executionRouter);
    this.app.use("/autonomy", fireDrillRouter);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      return res.status(404).json({
        error: "Not found",
        path: req.path,
        method: req.method,
      });
    });
  }

  private setupErrorHandler(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error("API Error:", err);
      return res.status(500).json({
        error: "Internal server error",
        message: err.message,
      });
    });
  }

  private setupCronSchedules(): void {
    if (process.env.CIC_PDF_REPORTS_ENABLED !== 'true') {
      return; // Disabled by default
    }

    try {
      // Dynamic import for generatePdfReport
      const importPdfReports = async () => {
        const { generatePdfReport } = await import("../reports/cicCostComputePdf.js");
        return generatePdfReport;
      };

      // Daily PDF report at midnight (0 0 * * *)
      const dailyJob = cron.schedule('0 0 * * *', async () => {
        try {
          const { generatePdfReport } = await importPdfReports();
          await generatePdfReport('daily');
        } catch (err) {
          console.error("[CRON] Daily PDF generation failed:", err);
        }
      });
      this.cronJobs.push(dailyJob);
      console.log("[CRON] Scheduled daily PDF report at midnight");

      // Weekly PDF report every Monday at midnight (0 0 * * 1)
      const weeklyJob = cron.schedule('0 0 * * 1', async () => {
        try {
          const { generatePdfReport } = await importPdfReports();
          await generatePdfReport('weekly');
        } catch (err) {
          console.error("[CRON] Weekly PDF generation failed:", err);
        }
      });
      this.cronJobs.push(weeklyJob);
      console.log("[CRON] Scheduled weekly PDF report for Mondays at midnight");
    } catch (err) {
      console.error("[CRON] Failed to setup schedules:", err);
    }
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Setup cron jobs before starting server
        this.setupCronSchedules();

        this.server = this.app.listen(
          this.config.port!,
          this.config.host!,
          () => {
            console.log(
              `[${new Date().toISOString()}] Autonomy API Server started on http://${this.config.host}:${this.config.port}`
            );
            resolve();
          }
        );

        this.server.on("error", (err: Error) => {
          console.error("Server error:", err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Stop all cron jobs
      this.cronJobs.forEach(job => job.stop());
      this.cronJobs = [];
      console.log(`[${new Date().toISOString()}] Cron jobs stopped`);

      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err: Error | undefined) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[${new Date().toISOString()}] Autonomy API Server stopped`);
          resolve();
        }
      });
    });
  }

  getApp(): Express {
    return this.app;
  }
}

export async function startAutonomyAPIServer(config: AutonomyAPIServerConfig): Promise<AutonomyAPIServer> {
  const server = new AutonomyAPIServer(config);
  await server.start();
  return server;
}
