/**
 * MemoryQueryClient — HTTP client for Phase 23.2 Memory Query API
 * Fetches signals and metrics for governance context
 */
import axios from 'axios';
export class MemoryQueryClient {
    constructor(baseUrl = 'http://localhost:3100') {
        this.http = axios.create({ baseURL: baseUrl });
    }
    /**
     * Get events by correlation ID (links to proposal)
     */
    async getEventsByProposal(proposalId) {
        const res = await this.http.get('/memory/events', {
            params: { correlationId: proposalId },
        });
        return (res.data.events || []);
    }
    /**
     * Get governance signal events
     */
    async getGovernanceSignals() {
        const res = await this.http.get('/memory/events', {
            params: { eventType: 'GOVERNANCE_SIGNAL', limit: '1000' },
        });
        return (res.data.events || []);
    }
    /**
     * Get recent events (last N days)
     */
    async getRecentEvents(days = 7) {
        const endDate = new Date().toISOString();
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const res = await this.http.get('/memory/events', {
            params: {
                startDate,
                endDate,
                limit: '10000',
            },
        });
        return (res.data.events || []);
    }
    /**
     * Get metric summaries (drift/health)
     */
    async getSummaries(metric = 'drift') {
        const res = await this.http.get('/memory/summaries', {
            params: { metric, window: 'hourly' },
        });
        return res.data;
    }
    /**
     * Get store statistics
     */
    async getStats() {
        const res = await this.http.get('/memory/stats');
        return res.data;
    }
}
//# sourceMappingURL=MemoryQueryClient.js.map