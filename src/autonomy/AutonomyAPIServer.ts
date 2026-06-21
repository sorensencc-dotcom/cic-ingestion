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
import { AutonomyService, AutonomyServiceConfig } from './AutonomyService.js';
import { createSignalsRouter } from './routes/signals.js';
import { createProposalsRouter } from './routes/proposals.js';
import { createCacheRouter } from './routes/cache.js';
import { createExecutionRouter } from './routes/execution.js';
import { createMemoryRouter } from './routes/memory.js';
import { createGovernanceRouter } from './routes/governance.js';
import { ObservabilityManager } from './ObservabilityManager.js';
import { wireVectorLayer } from '../vector/index.js';
import cicConfig, { CICConfig } from '../config/index.js';


export interface AutonomyAPIServerConfig extends AutonomyServiceConfig {
  port?: number;
  host?: string;
}

export class AutonomyAPIServer {
  private app: Express;
  private service: AutonomyService;
  private config: AutonomyAPIServerConfig;
  private cicConfig: CICConfig;
  private server: any = null;
  private observability: ObservabilityManager;

  constructor(config: AutonomyAPIServerConfig) {
    this.config = {
      port: 3000,
      host: 'localhost',
      ...config,
    };

    this.cicConfig = cicConfig;
    this.observability = ObservabilityManager.getInstance();
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

    // Observability middleware (request/response tracking)
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.observability.recordRequest(req, res, duration);
        const logger = this.observability.getLogger();
        logger.info('api', `${req.method} ${req.path}`, {
          status: res.statusCode,
          duration_ms: duration,
        });
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
    this.app.get('/health', (_req: Request, res: Response) => {
      return res.json({
        status: 'ok',
        service: 'autonomy-api',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    });

    // Metrics endpoint (Prometheus format)
    this.app.get('/metrics', (_req: Request, res: Response) => {
      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.send(this.observability.getMetricsPrometheus());
    });

    // Metrics JSON endpoint
    this.app.get('/metrics/json', (_req: Request, res: Response) => {
      return res.json(this.observability.getMetricsJSON());
    });

    // API info
    this.app.get('/autonomy', (_req: Request, res: Response) => {
      const endpoints: any = {
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
        cache: {
          'GET /autonomy/cache/metrics': 'Cache statistics (JSON)',
          'GET /autonomy/cache/metrics/prometheus': 'Cache metrics in Prometheus text format',
          'GET /autonomy/cache/status': 'Cache status (human-readable)',
        },
        execution: {
          'POST /autonomy/execution/register': 'Register execution context before scheduling',
          'GET /autonomy/execution/status/:taskId': 'Get current execution status',
          'GET /autonomy/execution/audit/:taskId': 'Get detailed audit trail',
          'POST /autonomy/execution/check': 'Pre-flight check if tool would be allowed',
          'GET /autonomy/execution/modes': 'List available execution modes and policies',
        },
        memory: {
          'POST /autonomy/memory/ingest': 'Ingest event into memory store',
          'POST /autonomy/memory/ingest-batch': 'Ingest multiple events into memory store',
          'GET /autonomy/memory/search': 'Search memory store',
          'GET /autonomy/memory/by-type/:type': 'Query memory by event type',
          'GET /autonomy/memory/by-agent/:agentId': 'Query memory by agent ID',
          'GET /autonomy/memory/by-correlation/:correlationId': 'Query memory by correlation ID',
        },
        governance: {
          'POST /autonomy/governance/votes': 'Submit proposal for council voting',
          'POST /autonomy/governance/votes/:proposalId/vote': 'Record individual council vote',
          'POST /autonomy/governance/decisions': 'Finalize governance decision',
          'GET /autonomy/governance/log': 'Get governance decision log',
          'GET /autonomy/governance/queue': 'Get pending approval queue',
          'GET /autonomy/governance/proposal/:proposalId': 'Get specific proposal details',
        },
        observability: {
          'GET /metrics': 'Prometheus format metrics',
          'GET /metrics/json': 'JSON format metrics',
        },
      };

      return res.json({
        service: 'CIC Autonomy API',
        version: '1.0.0',
        phase: '24.0',
        endpoints,
      });
    });

    // Phase 2.5: Config endpoint
    this.app.get('/autonomy/config', (_req: Request, res: Response) => {
      return res.json({
        phase: '2.5',
        loaded: true,
        source: 'env+defaults',
        services: this.cicConfig.services,
        timestamp: new Date().toISOString(),
      });
    });

    // Mount routers
    const signalsRouter = createSignalsRouter(this.service);
    const proposalsRouter = createProposalsRouter(this.service);
    const cacheRouter = createCacheRouter(this.service.getCacheAdapter());
    const executionRouter = createExecutionRouter();
    const memoryRouter = createMemoryRouter({
      memoryStoreUrl: process.env.MEMORY_STORE_URL,
    });
    const governanceRouter = createGovernanceRouter({
      governanceControlPlaneUrl: process.env.GOVERNANCE_URL,
    });

    this.app.use('/autonomy', signalsRouter);
    this.app.use('/autonomy', proposalsRouter);
    this.app.use('/autonomy', cacheRouter);
    this.app.use('/autonomy', executionRouter);
    this.app.use('/autonomy', memoryRouter);
    this.app.use('/autonomy', governanceRouter);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      return res.status(404).json({
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
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      const logger = this.observability.getLogger();
      logger.error('api', 'Unhandled error', err);

      // Sanitize error message to prevent path leakage
      let sanitizedMessage = 'Internal server error';
      if (err.message && !err.message.includes('/') && !err.message.includes('\\')) {
        sanitizedMessage = err.message;
      }

      return res.status(500).json({
        error: 'Internal server error',
        message: sanitizedMessage,
      });
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      await wireVectorLayer(this.app);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠ Failed to wire VectorLayer in dev mode (continuing):', (err as Error).message);
      } else {
        console.error('Failed to wire VectorLayer:', err);
        throw err;
      }
    }

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(
          this.config.port || 3000,
          this.config.host || 'localhost',
          () => {
            console.log(
              `[${new Date().toISOString()}] Autonomy API Server started on http://${this.config.host}:${this.config.port}`
            );
            console.log(
              `[${new Date().toISOString()}] Phase 2.5 Config loaded successfully`
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


