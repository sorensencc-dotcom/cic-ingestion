import { MemoryQueryValidationError, MemoryQueryNotFoundError, } from "./memory-query.errors";
export class MemoryQuery {
    constructor(store) {
        this.store = store;
    }
    toEnvelope(event) {
        return {
            id: event.id,
            eventType: event.event_type,
            timestamp: event.timestamp,
            payload: event.payload,
            sourceAgent: event.source_agent,
            sessionId: event.session_id,
            correlationId: event.correlation_id,
            checksum: event.checksum || "",
        };
    }
    async queryByType(options) {
        this.validateTimeRange(options.timeRange);
        const events = await this.store.query(options.eventType, options.timeRange?.from.toISOString(), options.timeRange?.to.toISOString());
        const envelopes = events.map((e) => this.toEnvelope(e));
        const paginated = this.paginate(envelopes, options.limit, options.offset);
        return {
            events: paginated,
            total: envelopes.length,
            limit: options.limit,
            offset: options.offset,
        };
    }
    async queryByCorrelationId(options) {
        this.validateTimeRange(options.timeRange);
        const allEvents = await this.store.query(undefined, options.timeRange?.from.toISOString(), options.timeRange?.to.toISOString());
        const filtered = allEvents.filter((e) => e.correlation_id === options.correlationId);
        if (filtered.length === 0) {
            throw new MemoryQueryNotFoundError(`No events found for correlationId: ${options.correlationId}`);
        }
        const envelopes = filtered.map((e) => this.toEnvelope(e));
        const paginated = this.paginate(envelopes, options.limit, options.offset);
        return {
            events: paginated,
            total: envelopes.length,
            limit: options.limit,
            offset: options.offset,
        };
    }
    async queryBySessionId(options) {
        this.validateTimeRange(options.timeRange);
        const allEvents = await this.store.query(undefined, options.timeRange?.from.toISOString(), options.timeRange?.to.toISOString());
        const filtered = allEvents.filter((e) => e.session_id === options.sessionId);
        if (filtered.length === 0) {
            throw new MemoryQueryNotFoundError(`No events found for sessionId: ${options.sessionId}`);
        }
        const envelopes = filtered.map((e) => this.toEnvelope(e));
        const paginated = this.paginate(envelopes, options.limit, options.offset);
        return {
            events: paginated,
            total: envelopes.length,
            limit: options.limit,
            offset: options.offset,
        };
    }
    async reconstructSession(sessionId) {
        const result = await this.queryBySessionId({
            sessionId,
            limit: undefined,
            offset: 0,
        });
        const eventTypeBreakdown = {
            ARPS_DELTA: 0,
            PIPELINE_RUN: 0,
            AGENT_TELEMETRY: 0,
            GOVERNANCE_SIGNAL: 0,
            APR_PLAN: 0,
            CRO_RUN: 0,
        };
        for (const envelope of result.events) {
            eventTypeBreakdown[envelope.eventType]++;
        }
        const sorted = result.events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return {
            sessionId,
            startTime: sorted.length > 0 ? sorted[0].timestamp : "",
            endTime: sorted.length > 0 ? sorted[sorted.length - 1].timestamp : "",
            eventCount: result.total,
            events: sorted,
            eventTypeBreakdown,
        };
    }
    async governanceLineage(correlationId) {
        const result = await this.queryByCorrelationId({
            correlationId,
            limit: undefined,
            offset: 0,
        });
        const governanceDecisions = result.events.filter((e) => e.eventType === "GOVERNANCE_SIGNAL");
        const executionTrace = result.events.filter((e) => e.eventType === "CRO_RUN" || e.eventType === "PIPELINE_RUN");
        return {
            correlationId,
            events: result.events,
            governanceDecisions,
            executionTrace,
        };
    }
    async getEventTimeline(days = 7) {
        const events = await this.store.queryRecent(days);
        const envelopes = events.map((e) => this.toEnvelope(e));
        return {
            events: envelopes,
            total: envelopes.length,
        };
    }
    validateTimeRange(range) {
        if (!range)
            return;
        if (range.from > range.to) {
            throw new MemoryQueryValidationError("timeRange.from must be <= timeRange.to");
        }
    }
    paginate(items, limit, offset = 0) {
        if (offset >= items.length) {
            return [];
        }
        const endIndex = limit ? offset + limit : items.length;
        return items.slice(offset, endIndex);
    }
}
//# sourceMappingURL=memory-query.js.map