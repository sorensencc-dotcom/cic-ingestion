/**
 * Autonomy API Server (Phase 23.7.3)
 * Express server that exposes autonomy endpoints:
 * - POST /autonomy/signals — detect signals
 * - GET /autonomy/signals — query signals
 * - GET /autonomy/proposals — query proposals
 * - POST /autonomy/proposals — generate proposals
 * - PUT /autonomy/proposals/:id — update proposal status
 */
import { Express } from 'express';
import { AutonomyService, AutonomyServiceConfig } from './AutonomyService.js';
export interface AutonomyAPIServerConfig extends AutonomyServiceConfig {
    port?: number;
    host?: string;
}
export declare class AutonomyAPIServer {
    private app;
    private service;
    private config;
    private cicConfig;
    private server;
    private observability;
    constructor(config: AutonomyAPIServerConfig);
    /**
     * Setup Express middleware
     */
    private setupMiddleware;
    /**
     * Setup routes
     */
    private setupRoutes;
    /**
     * Setup error handler
     */
    private setupErrorHandler;
    /**
     * Start the server
     */
    start(): Promise<void>;
    /**
     * Stop the server
     */
    stop(): Promise<void>;
    /**
     * Get the underlying Express app (for testing)
     */
    getApp(): Express;
    /**
     * Get the service (for testing)
     */
    getService(): AutonomyService;
}
/**
 * Convenience function to start the server
 */
export declare function startAutonomyAPIServer(config: AutonomyAPIServerConfig): Promise<AutonomyAPIServer>;
//# sourceMappingURL=AutonomyAPIServer.d.ts.map