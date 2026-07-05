/**
 * CIC Autonomy API Server
 * Express server exposing autonomy + execution + fire-drill endpoints
 */
import { Express } from "express";
export interface AutonomyAPIServerConfig {
    port?: number;
    host?: string;
    memoryQueryApiUrl?: string;
    roadmapContext?: any;
}
export declare class AutonomyAPIServer {
    private app;
    private config;
    private server;
    private cronJobs;
    constructor(config?: AutonomyAPIServerConfig);
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandler;
    private setupCronSchedules;
    start(): Promise<void>;
    stop(): Promise<void>;
    getApp(): Express;
}
export declare function startAutonomyAPIServer(config: AutonomyAPIServerConfig): Promise<AutonomyAPIServer>;
//# sourceMappingURL=AutonomyAPIServer.d.ts.map