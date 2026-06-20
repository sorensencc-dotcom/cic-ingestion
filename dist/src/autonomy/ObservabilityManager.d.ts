/**
 * Observability Manager for Autonomy API
 * Structured logging, metrics export (Prometheus), Caveman stats tracking
 * Phase 4: Logger injection + metrics export
 */
import { Request, Response } from 'express';
import { CavemanStatsV1 } from '../caveman/CavemanStats.js';
export interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    module: string;
    message: string;
    data?: Record<string, any>;
    stack?: string;
}
export interface MetricsSnapshot {
    requests_total: number;
    requests_by_status: Record<string, number>;
    requests_by_endpoint: Record<string, number>;
    latency_p50: number;
    latency_p95: number;
    latency_p99: number;
    caveman_stats_total: {
        bytes_in: number;
        bytes_out: number;
        bytes_saved: number;
    };
    caveman_compression_ratio: number;
    active_signals: number;
    active_proposals: number;
}
/**
 * Logger interface for dependency injection
 */
export interface Logger {
    debug(module: string, message: string, data?: Record<string, any>): void;
    info(module: string, message: string, data?: Record<string, any>): void;
    warn(module: string, message: string, data?: Record<string, any>): void;
    error(module: string, message: string, error?: Error | Record<string, any>): void;
}
/**
 * Observability Manager — singleton for coordinating logging and metrics
 */
export declare class ObservabilityManager {
    private static instance;
    private logger;
    private metrics;
    private constructor();
    static getInstance(logger?: Logger): ObservabilityManager;
    /**
     * Get logger for injection into services
     */
    getLogger(): Logger;
    /**
     * Record HTTP request metrics
     */
    recordRequest(req: Request, res: Response, duration: number): void;
    /**
     * Record Caveman compression stats
     */
    recordCavemanStats(stats: CavemanStatsV1 | any): void;
    /**
     * Update active signal count
     */
    setActiveSignals(count: number): void;
    /**
     * Update active proposal count
     */
    setActiveProposals(count: number): void;
    /**
     * Export metrics in Prometheus format
     */
    getMetricsPrometheus(): string;
    /**
     * Get metrics as JSON
     */
    getMetricsJSON(): MetricsSnapshot;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
}
//# sourceMappingURL=ObservabilityManager.d.ts.map