import * as fs from 'fs/promises';
import { createHash } from 'crypto';
function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
const SCHEMAS = {
    ARPS_DELTA: {
        change_type: { required: true, type: 'string' },
        phase_id: { required: false, type: 'string' },
        old_value: { required: true, type: 'string' },
        new_value: { required: true, type: 'string' },
        git_commit: { required: true, type: 'string' },
        confidence: { required: true, type: 'number' },
        affected_subsystems: { required: true, type: 'array' },
    },
    PIPELINE_RUN: {
        pipeline_name: { required: true, type: 'string' },
        pipeline_id: { required: true, type: 'string' },
        status: { required: true, type: 'string' },
        start_time: { required: true, type: 'string' },
        end_time: { required: true, type: 'string' },
        duration_ms: { required: true, type: 'number' },
        items_processed: { required: true, type: 'number' },
        items_successful: { required: true, type: 'number' },
        items_failed: { required: true, type: 'number' },
        error_summary: { required: false, type: 'string' },
        metrics: { required: true, type: 'object' },
        failed_items: { required: false, type: 'array' },
    },
    AGENT_TELEMETRY: {
        agent_name: { required: true, type: 'string' },
        agent_class: { required: true, type: 'string' },
        status: { required: true, type: 'string' },
        uptime_seconds: { required: true, type: 'number' },
        task_count: { required: true, type: 'number' },
        task_success_rate: { required: true, type: 'number' },
        last_error: { required: false, type: 'string' },
        last_error_time: { required: false, type: 'string' },
        performance: { required: true, type: 'object' },
        degradation_reason: { required: false, type: 'string' },
    },
    GOVERNANCE_SIGNAL: {
        signal_type: { required: true, type: 'string' },
        entity_type: { required: true, type: 'string' },
        entity_id: { required: true, type: 'string' },
        decision: { required: true, type: 'string' },
        reason: { required: true, type: 'string' },
        operator: { required: false, type: 'string' },
        approval_count: { required: true, type: 'number' },
        approval_threshold: { required: true, type: 'number' },
        metadata: { required: true, type: 'object' },
    },
    APR_PLAN: {
        plan_id: { required: true, type: 'string' },
        goal: { required: true, type: 'string' },
        plan_type: { required: true, type: 'string' },
        status: { required: true, type: 'string' },
        task_count: { required: true, type: 'number' },
        task_graph: { required: true, type: 'array' },
        critical_path_hours: { required: true, type: 'number' },
        risk_level: { required: true, type: 'string' },
        risk_factors: { required: true, type: 'array' },
        agent_consensus_score: { required: true, type: 'number' },
        agents_involved: { required: true, type: 'array' },
    },
    CRO_RUN: {
        run_id: { required: true, type: 'string' },
        plan_id: { required: true, type: 'string' },
        status: { required: true, type: 'string' },
        start_time: { required: true, type: 'string' },
        end_time: { required: true, type: 'string' },
        duration_ms: { required: true, type: 'number' },
        step_count: { required: true, type: 'number' },
        step_results: { required: true, type: 'array' },
        failure_info: { required: false, type: 'object' },
        recovery_action: { required: false, type: 'string' },
    },
};
export class MemoryStore {
    constructor(storePath = 'memory_store.json') {
        this.events = [];
        this.corruptedEventIds = new Set();
        this.storePath = storePath;
    }
    /**
     * Load existing events from disk (on startup)
     */
    async load() {
        try {
            const data = await fs.readFile(this.storePath, 'utf-8');
            this.events = JSON.parse(data);
            // Validate checksums on load
            this.events = this.events.filter(evt => {
                try {
                    if (evt.checksum) {
                        this.validateChecksum(evt);
                    }
                    return true;
                }
                catch (error) {
                    console.warn(`CORRUPTED_EVENT on load: ${evt.id}`, error);
                    this.corruptedEventIds.add(evt.id);
                    return false;
                }
            });
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist yet, start fresh
                this.events = [];
            }
            else {
                throw new Error(`Failed to load memory store: ${error.message}`);
            }
        }
    }
    /**
     * Append a single event (immutable, atomic)
     */
    async append(event) {
        // Validate payload schema
        const validation = this.validatePayloadSchema(event.event_type, event.payload);
        if (!validation.valid) {
            throw new Error(`Schema validation failed: ${validation.errors.join(', ')}`);
        }
        // Validate common fields
        const commonValidation = this.validateCommonFields(event);
        if (!commonValidation.valid) {
            throw new Error(`Field validation failed: ${commonValidation.errors.join(', ')}`);
        }
        // Create final event
        const finalEvent = {
            id: `evt_${generateUuid()}`,
            timestamp: new Date().toISOString(),
            version: 1,
            ...event,
        };
        // Compute checksum
        finalEvent.checksum = this.computeChecksum(finalEvent);
        // Append to in-memory store
        this.events.push(finalEvent);
        // Persist to disk (atomic write)
        await this.persistToDisk();
        return finalEvent;
    }
    /**
     * Query events with filters
     */
    async query(options = {}) {
        let results = [...this.events];
        if (options.event_type) {
            results = results.filter(e => e.event_type === options.event_type);
        }
        if (options.source_agent) {
            results = results.filter(e => e.source_agent === options.source_agent);
        }
        if (options.session_id) {
            results = results.filter(e => e.session_id === options.session_id);
        }
        if (options.correlation_id) {
            results = results.filter(e => e.correlation_id === options.correlation_id);
        }
        if (options.after_timestamp) {
            results = results.filter(e => e.timestamp >= options.after_timestamp);
        }
        if (options.before_timestamp) {
            results = results.filter(e => e.timestamp <= options.before_timestamp);
        }
        // Apply offset and limit
        const offset = options.offset || 0;
        const limit = options.limit || 1000;
        results = results.slice(offset, offset + limit);
        return results;
    }
    /**
     * Get all events (careful with large stores)
     */
    async getAll() {
        return [...this.events];
    }
    /**
     * Get events from last N days
     */
    async getRecent(days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffTime = cutoff.toISOString();
        return this.query({ after_timestamp: cutoffTime });
    }
    /**
     * Get event count by type
     */
    async getEventCounts() {
        const counts = {};
        for (const evt of this.events) {
            counts[evt.event_type] = (counts[evt.event_type] || 0) + 1;
        }
        return counts;
    }
    /**
     * Clear all events (destructive, use with caution)
     */
    async clear() {
        this.events = [];
        this.corruptedEventIds.clear();
        await this.persistToDisk();
    }
    /**
     * Get stats about the store
     */
    async getStats() {
        const stats = await fs.stat(this.storePath).catch(() => null);
        const counts = await this.getEventCounts();
        return {
            total_events: this.events.length,
            corrupted_events: this.corruptedEventIds.size,
            event_types: counts,
            store_size_bytes: stats?.size || 0,
            date_range: this.events.length > 0
                ? { oldest: this.events[0].timestamp, newest: this.events[this.events.length - 1].timestamp }
                : null,
        };
    }
    // Private methods
    validateCommonFields(event) {
        const errors = [];
        if (!event.source_agent || typeof event.source_agent !== 'string') {
            errors.push('source_agent must be non-empty string');
        }
        if (!event.session_id || !/^session_\d{8}_\d{3,}$/.test(event.session_id)) {
            errors.push('session_id must match pattern session_YYYYMMDD_NNN');
        }
        if (!event.correlation_id || !/^corr_[a-z0-9]{6,}$/.test(event.correlation_id)) {
            errors.push('correlation_id must match pattern corr_[a-z0-9]{6,}');
        }
        if (typeof event.retention_days !== 'number' || event.retention_days <= 0) {
            errors.push('retention_days must be positive number');
        }
        if (!['ARPS_DELTA', 'PIPELINE_RUN', 'AGENT_TELEMETRY', 'GOVERNANCE_SIGNAL', 'APR_PLAN', 'CRO_RUN'].includes(event.event_type)) {
            errors.push('event_type must be one of 6 defined types');
        }
        return { valid: errors.length === 0, errors };
    }
    validatePayloadSchema(eventType, payload) {
        const errors = [];
        const schema = SCHEMAS[eventType];
        if (!schema) {
            errors.push(`Unknown event type: ${eventType}`);
            return { valid: false, errors };
        }
        // Check required fields
        for (const [field, spec] of Object.entries(schema)) {
            if (spec.required && !(field in payload)) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        // Check for unknown fields (strict validation)
        for (const field of Object.keys(payload)) {
            if (!(field in schema)) {
                errors.push(`Unknown field in payload: ${field}`);
            }
        }
        // Type checking for known fields
        for (const [field, value] of Object.entries(payload)) {
            const spec = schema[field];
            if (spec) {
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                if (actualType !== spec.type) {
                    errors.push(`Field ${field}: expected ${spec.type}, got ${actualType}`);
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }
    computeChecksum(event) {
        // Create a copy without the checksum field for hashing
        const { checksum, ...eventWithoutChecksum } = event;
        const hash = createHash('sha256');
        hash.update(JSON.stringify(eventWithoutChecksum));
        return `sha256:${hash.digest('hex')}`;
    }
    validateChecksum(event) {
        if (!event.checksum) {
            throw new Error('Missing checksum');
        }
        const computed = this.computeChecksum(event);
        if (computed !== event.checksum) {
            throw new Error(`Checksum mismatch: expected ${computed}, got ${event.checksum}`);
        }
    }
    async persistToDisk() {
        const tmpPath = `${this.storePath}.tmp`;
        const jsonData = JSON.stringify(this.events, null, 2);
        // Write to temporary file
        await fs.writeFile(tmpPath, jsonData, 'utf-8');
        // Atomic rename (ACID on most filesystems)
        await fs.rename(tmpPath, this.storePath);
    }
}
// Singleton instance
let instance = null;
export async function getMemoryStore(storePath) {
    if (!instance) {
        instance = new MemoryStore(storePath);
        await instance.load();
    }
    return instance;
}
export function resetMemoryStore() {
    instance = null;
}
//# sourceMappingURL=MemoryStore.js.map