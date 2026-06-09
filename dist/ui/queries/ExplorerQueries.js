/**
 * Query client for Memory Explorer UI (Phase 23.6)
 * Communicates with MemoryQueryAPI to fetch timeline, drift, and health data
 */
export class ExplorerClient {
    constructor(options) {
        this.subscriptions = new Map();
        this.baseUrl = options.baseUrl;
        this.timeout = options.timeout || 5000;
        this.pollInterval = options.pollInterval || 5000;
    }
    /**
     * Fetch timeline events with optional filtering
     */
    async getTimeline(filter, limit = 1000) {
        const params = new URLSearchParams();
        if (filter.startDate) {
            params.append('startDate', filter.startDate.toISOString());
        }
        if (filter.endDate) {
            params.append('endDate', filter.endDate.toISOString());
        }
        if (filter.types && filter.types.length > 0) {
            params.append('type', filter.types.join(','));
        }
        if (filter.severity && filter.severity.length > 0) {
            params.append('severity', filter.severity.join(','));
        }
        if (filter.correlationId) {
            params.append('correlationId', filter.correlationId);
        }
        if (filter.sessionId) {
            params.append('sessionId', filter.sessionId);
        }
        params.append('limit', limit.toString());
        const url = `${this.baseUrl}/memory/events?${params.toString()}`;
        return this.fetch(url);
    }
    /**
     * Fetch drift metrics for a given window
     */
    async getDriftMetrics(window) {
        const url = `${this.baseUrl}/memory/summaries?window=${window}&metric=drift`;
        return this.fetch(url);
    }
    /**
     * Fetch health metrics for a given window
     */
    async getHealthMetrics(window) {
        const url = `${this.baseUrl}/memory/summaries?window=${window}&metric=health`;
        return this.fetch(url);
    }
    /**
     * Reconstruct correlation trace from correlation ID
     */
    async getCorrelationTrace(correlationId) {
        const url = `${this.baseUrl}/memory/events?correlationId=${encodeURIComponent(correlationId)}`;
        const events = await this.fetch(url);
        if (events.length === 0) {
            throw new Error(`No events found for correlation ID: ${correlationId}`);
        }
        const initiatingEvent = events[0];
        const timeline = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return {
            correlationId,
            initiatingEvent,
            relatedEvents: events.slice(1),
            timeline,
            criticalPath: this.calculateCriticalPath(timeline),
            duration: new Date(timeline[timeline.length - 1].timestamp).getTime() -
                new Date(timeline[0].timestamp).getTime(),
        };
    }
    /**
     * Subscribe to real-time event updates
     * Returns unsubscribe function
     */
    subscribeToEvents(callback, filter) {
        const subscriptionId = `sub_${Date.now()}_${Math.random()}`;
        const poll = async () => {
            try {
                const events = await this.getTimeline(filter || {}, 100);
                // Emit latest event
                if (events.length > 0) {
                    callback(events[0]);
                }
            }
            catch (err) {
                console.error('Subscription poll error:', err);
            }
        };
        const timerId = setInterval(poll, this.pollInterval);
        this.subscriptions.set(subscriptionId, timerId);
        // Initial poll
        poll();
        return () => {
            const timer = this.subscriptions.get(subscriptionId);
            if (timer) {
                clearInterval(timer);
                this.subscriptions.delete(subscriptionId);
            }
        };
    }
    /**
     * Generic fetch with timeout and error handling
     */
    async fetch(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return (await response.json());
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * Calculate critical path (simplistic DAG of causality)
     * Assumes temporal ordering indicates causality
     */
    calculateCriticalPath(timeline) {
        if (timeline.length <= 1)
            return timeline;
        // For now, assume all events in sequence form critical path
        // TODO: Improve with true causal analysis from metadata
        return timeline;
    }
    /**
     * Cleanup subscriptions
     */
    destroy() {
        for (const timerId of this.subscriptions.values()) {
            clearInterval(timerId);
        }
        this.subscriptions.clear();
    }
}
//# sourceMappingURL=ExplorerQueries.js.map