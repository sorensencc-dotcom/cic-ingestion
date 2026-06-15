/**
 * Autonomy API Server (Phase 23.7.3)
 * Express server that exposes autonomy endpoints:
 * - POST /autonomy/signals — detect signals
 * - GET /autonomy/signals — query signals
 * - GET /autonomy/proposals — query proposals
 * - POST /autonomy/proposals — generate proposals
 * - PUT /autonomy/proposals/:id — update proposal status
 */
import express from 'express';
import { AutonomyService } from './AutonomyService';
import { createSignalsRouter } from './routes/signals';
import { createProposalsRouter } from './routes/proposals';
import { createCacheRouter } from './routes/cache';
import { createMemoryRouter } from './routes/memory';
import { createGovernanceRouter } from '../governance/routes/governance';
import { ObservabilityManager } from './ObservabilityManager';
import { wireVectorLayer } from '../vector/index.js';
export class AutonomyAPIServer {
    constructor(config) {
        this.server = null;
        this.config = {
            port: 3000,
            host: 'localhost',
            ...config,
        };
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
    setupMiddleware() {
        // JSON body parser
        this.app.use(express.json({ limit: '10mb' }));
        // Observability middleware (request/response tracking)
        this.app.use((req, res, next) => {
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
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            }
            else {
                next();
            }
        });
    }
    /**
     * Setup routes
     */
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            return res.json({
                status: 'ok',
                service: 'autonomy-api',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            });
        });
        // Metrics endpoint (Prometheus format)
        this.app.get('/metrics', (req, res) => {
            res.set('Content-Type', 'text/plain; charset=utf-8');
            return res.send(this.observability.getMetricsPrometheus());
        });
        // Metrics JSON endpoint
        this.app.get('/metrics/json', (req, res) => {
            return res.json(this.observability.getMetricsJSON());
        });
        // API info
        this.app.get('/autonomy', (req, res) => {
            const endpoints = {
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
                observability: {
                    'GET /metrics': 'Prometheus format metrics',
                    'GET /metrics/json': 'JSON format metrics',
                },
            };
            // (Phase 23.2) Add memory endpoints if MemoryStore is available
            if (this.config.memoryStore) {
                endpoints.memory = {
                    'GET /memory/events': 'Query events (by type, agent, session, time)',
                    'GET /memory/summaries': 'Get metric summaries (drift/health)',
                    'GET /memory/stats': 'Get store statistics',
                    'POST /memory/append': 'Append a single event',
                };
            }
            // (Phase 24) Add governance endpoints
            endpoints.governance = {
                'POST /governance/proposals': 'Submit new proposal',
                'POST /governance/votes': 'Vote on proposal',
                'POST /governance/decisions/:proposalId/finalize': 'Finalize proposal decision',
                'GET /governance/context/:proposalId': 'Get proposal context (history + signals)',
                'POST /governance/evolution/amendments': 'Generate amendment proposals',
                'POST /governance/evolution/constraints': 'Generate constraint updates',
                'POST /governance/evolution/policies': 'Generate policy changes',
                'POST /governance/evolution/full-cycle': 'Run full evolution cycle',
            };
            return res.json({
                service: 'CIC Autonomy API',
                version: '1.0.0',
                phase: '24.0',
                endpoints,
            });
        });
        // Mount routers
        const signalsRouter = createSignalsRouter(this.service);
        const proposalsRouter = createProposalsRouter(this.service);
        const cacheRouter = createCacheRouter(this.service.getCacheAdapter());
        this.app.use('/autonomy', signalsRouter);
        this.app.use('/autonomy', proposalsRouter);
        this.app.use('/autonomy', cacheRouter);
        // (Phase 23.2) Mount memory routes if MemoryStore is available
        if (this.config.memoryStore) {
            const memoryRouter = createMemoryRouter({
                memoryStore: this.config.memoryStore,
            });
            this.app.use('/memory', memoryRouter);
        }
        // (Phase 24) Mount governance routes
        const governanceRouter = createGovernanceRouter();
        this.app.use('/governance', governanceRouter);
        // 404 handler
        this.app.use((req, res) => {
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
    setupErrorHandler() {
        this.app.use((err, _req, res, _next) => {
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
    async start() {
        try {
            await wireVectorLayer(this.app);
        }
        catch (err) {
            console.error('Failed to wire VectorLayer:', err);
            throw err;
        }
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port || 3000, this.config.host || 'localhost', () => {
                    console.log(`[${new Date().toISOString()}] Autonomy API Server started on http://${this.config.host}:${this.config.port}`);
                    console.log(`[${new Date().toISOString()}] MemoryQueryAPI: ${this.config.memoryQueryApiUrl}`);
                    resolve();
                });
                this.server.on('error', (err) => {
                    console.error('Server error:', err);
                    reject(err);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    /**
     * Stop the server
     */
    async stop() {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    console.log(`[${new Date().toISOString()}] Autonomy API Server stopped`);
                    resolve();
                }
            });
        });
    }
    /**
     * Get the underlying Express app (for testing)
     */
    getApp() {
        return this.app;
    }
    /**
     * Get the service (for testing)
     */
    getService() {
        return this.service;
    }
}
/**
 * Convenience function to start the server
 */
export async function startAutonomyAPIServer(config) {
    const server = new AutonomyAPIServer(config);
    await server.start();
    return server;
}
//# sourceMappingURL=AutonomyAPIServer.js.map