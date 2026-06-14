// filename: orchestrator/index.ts
// Orchestrator Service Entrypoint
// HTTP server with Wayland integration + reasoning endpoints
import express from 'express';
import { WaylandOrchestratorEndpoint } from './wayland-endpoint.js';
// Minimal logger (replace with full logger in production)
const logger = {
    info: (event, data) => {
        console.log(`[INFO] ${event}`, data ? JSON.stringify(data) : '');
    },
    warn: (event, data) => {
        console.warn(`[WARN] ${event}`, data ? JSON.stringify(data) : '');
    },
    error: (event, data) => {
        console.error(`[ERROR] ${event}`, data ? JSON.stringify(data) : '');
    },
};
const PORT = process.env.ORCHESTRATOR_PORT || 7001;
const app = express();
// Middleware
app.use(express.json());
// Health check
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'orchestrator',
        timestamp: new Date().toISOString(),
    });
});
// Wayland integration endpoint
const waylandEndpoint = new WaylandOrchestratorEndpoint(logger);
waylandEndpoint.register(app);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Endpoint not found: ${req.method} ${req.path}`,
    });
});
// Error handler
app.use((err, req, res) => {
    logger.error('unhandled.error', {
        path: req.path,
        method: req.method,
        error: err.message,
    });
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});
// Start server
const server = app.listen(PORT, () => {
    logger.info('orchestrator.start', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('orchestrator.shutdown');
    server.close(() => {
        logger.info('orchestrator.closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger.info('orchestrator.interrupt');
    server.close(() => {
        logger.info('orchestrator.closed');
        process.exit(0);
    });
});
//# sourceMappingURL=index.js.map