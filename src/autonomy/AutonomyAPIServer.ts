/**
 * CIC Autonomy API Server
 * Express server exposing autonomy + execution + fire-drill endpoints
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cron from "node-cron";
import { createExecutionRouter } from "./routes/execution.js";
import { createFireDrillRouter } from "./routes/firedrills.js";
import { createConsoleRouter } from "./routes/console.js";
import { createMemoryRouter } from "./routes/memory.js";
import { createGovernanceRouter } from "./routes/governance.js";
import { AdapterRegistry } from "../adapters/AdapterRegistry.js";
import { AdapterIntegrationService } from "../services/AdapterIntegrationService.js";
import { GrokHardenedAdapter } from "../adapters/grok/GrokHardenedAdapter.js";
import { GrokProvider } from "../adapters/grok/grok-provider.js";
import { GrokMcpClient } from "../adapters/grok/grok-mcp-client.js";
import { GrokModelClient } from "../adapters/grok/grok-model-client.js";
import { ConsoleMetricsAdapter } from "../adapters/metrics/ConsoleMetricsAdapter.js";
import { createExecuteRouter } from "../routes/execute.js";
import { UsageLedger } from "../lib/usage/UsageLedger.js";
import { generateCicCostComputeReport } from "../lib/report/CicCostComputeReport.js";
import { TorqueQueryClient } from "../../src/services/torquequery/TorqueQueryClient";
import { HardeningRegistry } from "../../src/resilience/hardeningOrchestrator";
import { CircuitBreakerRegistry } from "../../src/resilience/circuitBreaker";
import { RateLimiterRegistry } from "../../src/resilience/rateLimiter";
import { ResilientMetricsCollector } from "../../src/observability/resilientMetricsCollector";

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
    const memoryRouter = createMemoryRouter({
      memoryStoreUrl: this.config.memoryQueryApiUrl || process.env.MEMORY_STORE_URL || "http://localhost:3110",
    });
    const governanceRouter = createGovernanceRouter({
      governanceControlPlaneUrl: process.env.GOVERNANCE_URL || "http://localhost:3113",
    });

    this.app.use("/autonomy", executionRouter);
    this.app.use("/autonomy", fireDrillRouter);
    this.app.use("/autonomy", memoryRouter);
    this.app.use("/autonomy", governanceRouter);

    // Grok Hardened Adapter (Phase A+B+C: Cache + Hardening)
    const adapterRegistry = new AdapterRegistry();
    const torqueQueryUrl = this.config.memoryQueryApiUrl || process.env.MEMORY_STORE_URL || "http://localhost:3110";
    const grokMcpClient = new GrokMcpClient(torqueQueryUrl);
    const grokModelClient = new GrokModelClient(
      process.env.GROK_MODEL_BASE_URL || "https://api.x.ai",
      process.env.GROK_API_KEY || process.env.XAI_API_KEY || "mock-api-key"
    );
    const grokProvider = new GrokProvider(grokMcpClient, grokModelClient);

    // Initialize hardening infrastructure (Phase B)
    const circuitBreakerRegistry = new CircuitBreakerRegistry();
    const rateLimiterRegistry = new RateLimiterRegistry();
    const hardeningRegistry = new HardeningRegistry();

    const metricsCollector = new ResilientMetricsCollector(
      hardeningRegistry,
      circuitBreakerRegistry,
      rateLimiterRegistry
    );

    const grokHardenedAdapter = new GrokHardenedAdapter(
      {
        name: "grok-hardened",
        version: "1.0.0",
        timeout: 30000,
        retries: 2,
      },
      grokProvider,
      hardeningRegistry,
      true, // cacheEnabled
      true  // contextCacheEnabled
    );

    adapterRegistry.register("xai-docs-mcp", grokHardenedAdapter);
    adapterRegistry.register("grok", grokHardenedAdapter);

    // Console Metrics Adapter (Phase 8)
    const torqueQueryClient = new TorqueQueryClient(torqueQueryUrl);
    const consoleMetricsAdapter = new ConsoleMetricsAdapter({
      name: "console-metrics",
      version: "1.0.0",
      timeout: 5000,
      retries: 1,
      torqueQuery: torqueQueryClient,
    });
    adapterRegistry.register("console-metrics", consoleMetricsAdapter);

    // Mount console router
    const consoleRouter = createConsoleRouter(torqueQueryClient, new AdapterIntegrationService(adapterRegistry));
    this.app.use("/", consoleRouter);

    // Expose metrics endpoint for Prometheus scraping (Phase C observability)
    this.app.get("/metrics", (req: Request, res: Response) => {
      return res.type("text/plain").send(metricsCollector.getPrometheusMetrics());
    });

    const adapterService = new AdapterIntegrationService(adapterRegistry);
    const executeRouter = createExecuteRouter(adapterService);
    this.app.use("/", executeRouter);

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
        const { generatePdfReport } = await import("../../reports/cicCostComputePdf.js");
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
