/**
 * Autonomy API Server (Phase 23.7.3)
 * Express server that exposes autonomy endpoints:
 * - POST /autonomy/signals — detect signals
 * - GET /autonomy/signals — query signals
 * - GET /autonomy/proposals — query proposals
 * - POST /autonomy/proposals — generate proposals
 * - PUT /autonomy/proposals/:id — update proposal status
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { AutonomyService, AutonomyServiceConfig } from './AutonomyService';
import { createSignalsRouter } from './routes/signals';
import { createProposalsRouter } from './routes/proposals';

export interface AutonomyAPIServerConfig extends AutonomyServiceConfig {
  port?: number;
  host?: string;
}

export class AutonomyAPIServer {
  private app: Express;
  private service: AutonomyService;
  private config: AutonomyAPIServerConfig;
  private server: any = null;

  constructor(config: AutonomyAPIServerConfig) {
    this.config = {
      port: 3000,
      host: 'localhost',
      ...config,
    };

    this.app = express();
    this.service = new AutonomyService(config);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandler();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
          `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
        );
      });
      next();
    });

    // CORS headers (allow all for now)
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        service: 'autonomy-api',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    // API info
    this.app.get('/autonomy', (req: Request, res: Response) => {
      res.json({
        service: 'CIC Autonomy API',
        version: '1.0.0',
        phase: '23.7',
        endpoints: {
          signals: {
            'POST /autonomy/signals': 'Detect signals from event history',
            'GET /autonomy/signals': 'Query stored signals',
            'GET /autonomy/signals/:id': 'Get specific signal',
            'GET /autonomy/signals/trends/:metric': 'Get signal trends',
          },
          proposals: {
            'GET /autonomy/proposals': 'Query stored proposals',
            'GET /autonomy/proposals/:id': 'Get specific proposal',
            'POST /autonomy/proposals': 'Generate proposals from signals',
            'PUT /autonomy/proposals/:id': 'Update proposal status',
            'POST /autonomy/proposals/simulate': 'Simulate proposal execution',
          },
        },
      });
    });

    // Mount routers
    const signalsRouter = createSignalsRouter(this.service);
    const proposalsRouter = createProposalsRouter(this.service);

    this.app.use('/autonomy', signalsRouter);
    this.app.use('/autonomy', proposalsRouter);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
        method: req.method,
      });
    });
  }

  /**
   * Setup error handler
   */
  private setupErrorHandler(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Unhandled error:', err);
      console.error('Stack:', err.stack);

      // Sanitize error message to prevent path leakage
      let sanitizedMessage = 'Internal server error';
      if (err.message && !err.message.includes('/') && !err.message.includes('\\')) {
        sanitizedMessage = err.message;
      }

      res.status(500).json({
        error: 'Internal server error',
        message: sanitizedMessage,
      });
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(
          this.config.port,
          this.config.host,
          () => {
            console.log(
              `[${new Date().toISOString()}] Autonomy API Server started on http://${this.config.host}:${this.config.port}`
            );
            console.log(
              `[${new Date().toISOString()}] MemoryQueryAPI: ${this.config.memoryQueryApiUrl}`
            );
            resolve();
          }
        );

        this.server.on('error', (err: Error) => {
          console.error('Server error:', err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stop the server
   */
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

  /**
   * Get the underlying Express app (for testing)
   */
  getApp(): Express {
    return this.app;
  }

  /**
   * Get the service (for testing)
   */
  getService(): AutonomyService {
    return this.service;
  }
}

/**
 * Convenience function to start the server
 */
export async function startAutonomyAPIServer(
  config: AutonomyAPIServerConfig
): Promise<AutonomyAPIServer> {
  const server = new AutonomyAPIServer(config);
  await server.start();
  return server;
}
