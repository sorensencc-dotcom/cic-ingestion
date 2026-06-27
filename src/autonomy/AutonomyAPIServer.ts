/**
 * CIC Autonomy API Server
 * Express server exposing autonomy + execution + fire-drill endpoints
 */

import express, { Express, Request, Response, NextFunction } from "express";
import { createExecutionRouter } from "./routes/execution.js";
import { createFireDrillRouter } from "./routes/firedrills.js";

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

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
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
