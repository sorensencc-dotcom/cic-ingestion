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
export class AutonomyAPIServer {
    constructor(config) {
        this.server = null;
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
    setupMiddleware() {
        // JSON body parser
        this.app.use(express.json({ limit: '10mb' }));
        // Request logging middleware
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
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
            res.json({
                status: 'ok',
                service: 'autonomy-api',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            });
        });
        // API info
        this.app.get('/autonomy', (req, res) => {
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
        this.app.use((req, res) => {
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
    setupErrorHandler() {
        this.app.use((err, req, res, next) => {
            console.error('Unhandled error:', err);
            res.status(500).json({
                error: 'Internal server error',
                message: err.message,
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