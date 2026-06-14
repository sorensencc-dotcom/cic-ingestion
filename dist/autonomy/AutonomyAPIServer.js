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
import { ObservabilityManager } from './ObservabilityManager';
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
            return res.json({
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
                    observability: {
                        'GET /metrics': 'Prometheus format metrics',
                        'GET /metrics/json': 'JSON format metrics',
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
        this.app.use((err, req, res, next) => {
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
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port, this.config.host, () => {
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