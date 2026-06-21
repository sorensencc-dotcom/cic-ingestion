/**
 * Observability Manager for Autonomy API
 * Structured logging, metrics export (Prometheus), Caveman stats tracking
 * Phase 4: Logger injection + metrics export
 */
/**
 * Metrics collector for request tracking
 */
class MetricsCollector {
    constructor() {
        this.requestCount = 0;
        this.statusCounts = new Map();
        this.endpointCounts = new Map();
        this.latencies = [];
        this.cavemanBytesIn = 0;
        this.cavemanBytesOut = 0;
        this.activeSignals = 0;
        this.activeProposals = 0;
    }
    recordRequest(method, path, status, latency) {
        this.requestCount++;
        this.statusCounts.set(status, (this.statusCounts.get(status) || 0) + 1);
        const endpoint = `${method} ${path}`;
        this.endpointCounts.set(endpoint, (this.endpointCounts.get(endpoint) || 0) + 1);
        this.latencies.push(latency);
        if (this.latencies.length > 10000) {
            this.latencies = this.latencies.slice(-10000);
        }
    }
    recordCavemanStats(stats) {
        const bytesIn = stats.bytesIn || stats.bytes_in || 0;
        const bytesOut = stats.bytesOut || stats.bytes_out || 0;
        this.cavemanBytesIn += bytesIn;
        this.cavemanBytesOut += bytesOut;
    }
    setActiveSignals(count) {
        this.activeSignals = count;
    }
    setActiveProposals(count) {
        this.activeProposals = count;
    }
    getSnapshot() {
        const statusByCode = {};
        this.statusCounts.forEach((count, status) => {
            statusByCode[status] = count;
        });
        const endpointMetrics = {};
        this.endpointCounts.forEach((count, endpoint) => {
            endpointMetrics[endpoint] = count;
        });
        const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
        const p50Index = Math.floor(sortedLatencies.length * 0.5);
        const p95Index = Math.floor(sortedLatencies.length * 0.95);
        const p99Index = Math.floor(sortedLatencies.length * 0.99);
        return {
            requests_total: this.requestCount,
            requests_by_status: statusByCode,
            requests_by_endpoint: endpointMetrics,
            latency_p50: sortedLatencies[p50Index] || 0,
            latency_p95: sortedLatencies[p95Index] || 0,
            latency_p99: sortedLatencies[p99Index] || 0,
            caveman_stats_total: {
                bytes_in: this.cavemanBytesIn,
                bytes_out: this.cavemanBytesOut,
                bytes_saved: Math.max(0, this.cavemanBytesIn - this.cavemanBytesOut),
            },
            caveman_compression_ratio: this.cavemanBytesIn > 0
                ? Math.round((1 - this.cavemanBytesOut / this.cavemanBytesIn) * 10000) / 100
                : 0,
            active_signals: this.activeSignals,
            active_proposals: this.activeProposals,
        };
    }
    reset() {
        this.requestCount = 0;
        this.statusCounts.clear();
        this.endpointCounts.clear();
        this.latencies = [];
        this.cavemanBytesIn = 0;
        this.cavemanBytesOut = 0;
        this.activeSignals = 0;
        this.activeProposals = 0;
    }
}
/**
 * Console-based logger implementation
 */
class ConsoleLogger {
    debug(module, message, data) {
        this.log('debug', module, message, data);
    }
    info(module, message, data) {
        this.log('info', module, message, data);
    }
    warn(module, message, data) {
        this.log('warn', module, message, data);
    }
    error(module, message, error) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            module,
            message,
            data: error instanceof Error ? { error: error.message } : error,
            stack: error instanceof Error ? error.stack : undefined,
        };
        console.error(JSON.stringify(entry));
    }
    log(level, module, message, data) {
        if (level === 'debug')
            return; // Skip debug logs in console
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            module,
            message,
            data,
        };
        console.log(JSON.stringify(entry));
    }
}
/**
 * Observability Manager — singleton for coordinating logging and metrics
 */
export class ObservabilityManager {
    constructor(logger) {
        this.logger = logger || new ConsoleLogger();
        this.metrics = new MetricsCollector();
    }
    static getInstance(logger) {
        if (!ObservabilityManager.instance) {
            ObservabilityManager.instance = new ObservabilityManager(logger);
        }
        return ObservabilityManager.instance;
    }
    /**
     * Get logger for injection into services
     */
    getLogger() {
        return this.logger;
    }
    /**
     * Record HTTP request metrics
     */
    recordRequest(req, res, duration) {
        this.metrics.recordRequest(req.method, req.path, res.statusCode, duration);
    }
    /**
     * Record Caveman compression stats
     */
    recordCavemanStats(stats) {
        this.metrics.recordCavemanStats(stats);
    }
    /**
     * Update active signal count
     */
    setActiveSignals(count) {
        this.metrics.setActiveSignals(count);
    }
    /**
     * Update active proposal count
     */
    setActiveProposals(count) {
        this.metrics.setActiveProposals(count);
    }
    /**
     * Export metrics in Prometheus format
     */
    getMetricsPrometheus() {
        const snapshot = this.metrics.getSnapshot();
        let output = '# HELP autonomy_requests_total Total HTTP requests\n';
        output += `# TYPE autonomy_requests_total counter\n`;
        output += `autonomy_requests_total ${snapshot.requests_total}\n\n`;
        output += '# HELP autonomy_requests_by_status HTTP requests by status code\n';
        output += `# TYPE autonomy_requests_by_status gauge\n`;
        for (const [status, count] of Object.entries(snapshot.requests_by_status)) {
            output += `autonomy_requests_by_status{code="${status}"} ${count}\n`;
        }
        output += '\n';
        output += '# HELP autonomy_requests_by_endpoint HTTP requests by endpoint\n';
        output += `# TYPE autonomy_requests_by_endpoint gauge\n`;
        for (const [endpoint, count] of Object.entries(snapshot.requests_by_endpoint)) {
            const safe = endpoint.replace(/[{}]/g, '');
            output += `autonomy_requests_by_endpoint{endpoint="${safe}"} ${count}\n`;
        }
        output += '\n';
        output += '# HELP autonomy_latency_p50_ms Latency p50\n';
        output += `# TYPE autonomy_latency_p50_ms gauge\n`;
        output += `autonomy_latency_p50_ms ${snapshot.latency_p50}\n\n`;
        output += '# HELP autonomy_latency_p95_ms Latency p95\n';
        output += `# TYPE autonomy_latency_p95_ms gauge\n`;
        output += `autonomy_latency_p95_ms ${snapshot.latency_p95}\n\n`;
        output += '# HELP autonomy_latency_p99_ms Latency p99\n';
        output += `# TYPE autonomy_latency_p99_ms gauge\n`;
        output += `autonomy_latency_p99_ms ${snapshot.latency_p99}\n\n`;
        output += '# HELP autonomy_caveman_bytes_in Total bytes input to compression\n';
        output += `# TYPE autonomy_caveman_bytes_in counter\n`;
        output += `autonomy_caveman_bytes_in ${snapshot.caveman_stats_total.bytes_in}\n\n`;
        output += '# HELP autonomy_caveman_bytes_out Total bytes output after compression\n';
        output += `# TYPE autonomy_caveman_bytes_out counter\n`;
        output += `autonomy_caveman_bytes_out ${snapshot.caveman_stats_total.bytes_out}\n\n`;
        output += '# HELP autonomy_caveman_bytes_saved Total bytes saved by compression\n';
        output += `# TYPE autonomy_caveman_bytes_saved counter\n`;
        output += `autonomy_caveman_bytes_saved ${snapshot.caveman_stats_total.bytes_saved}\n\n`;
        output += '# HELP autonomy_caveman_compression_ratio Compression ratio (% saved)\n';
        output += `# TYPE autonomy_caveman_compression_ratio gauge\n`;
        output += `autonomy_caveman_compression_ratio ${snapshot.caveman_compression_ratio}\n\n`;
        output += '# HELP autonomy_active_signals Number of active signals in store\n';
        output += `# TYPE autonomy_active_signals gauge\n`;
        output += `autonomy_active_signals ${snapshot.active_signals}\n\n`;
        output += '# HELP autonomy_active_proposals Number of active proposals in store\n';
        output += `# TYPE autonomy_active_proposals gauge\n`;
        output += `autonomy_active_proposals ${snapshot.active_proposals}\n`;
        return output;
    }
    /**
     * Get metrics as JSON
     */
    getMetricsJSON() {
        return this.metrics.getSnapshot();
    }
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics.reset();
    }
}
//# sourceMappingURL=ObservabilityManager.js.map
