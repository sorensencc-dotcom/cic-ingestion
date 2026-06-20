import type { Request, Response } from 'express';
export interface Logger {
    info(event: string, data?: any): void;
    warn(event: string, data?: any): void;
    error(event: string, data?: any): void;
}
export interface ReasoningRequest {
    action: string;
    timestamp: string;
    metadata?: Record<string, any>;
}
export interface ReasoningResponse {
    status: 'ok' | 'error';
    requestId: string;
    action: string;
    result?: any;
    error?: string;
    processingTimeMs: number;
}
export declare class WaylandOrchestratorEndpoint {
    private logger;
    constructor(logger: Logger);
    handleReasoning(req: Request, res: Response<ReasoningResponse>): Promise<void>;
    private handleIngestReasoning;
    register(app: any): any;
}
//# sourceMappingURL=wayland-endpoint.d.ts.map