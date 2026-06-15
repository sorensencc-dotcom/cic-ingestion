import * as fs from "fs";
import * as path from "path";
import { ValidationError, LockError, WriteError, } from "./memory-store.errors";
import { MemoryValidator } from "../validation/memory-validator";
import { MemoryIntegrity } from "../integrity/memory-integrity";
function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
export class MemoryStore {
    constructor(storePath = "C:\\dev\\rewrite-mcp\\memory_store.json") {
        this.writeBuffer = [];
        this.writeBufferSize = 100;
        this.storePath = storePath;
        this.lockPath = `${storePath}.lock`;
        this.validator = new MemoryValidator();
        this.integrity = new MemoryIntegrity();
        this.ensureStorePath();
    }
    ensureStorePath() {
        const dir = path.dirname(this.storePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(this.storePath)) {
            fs.writeFileSync(this.storePath, "[]", "utf8");
        }
    }
    async append(event) {
        const id = generateUuid();
        const version = 1;
        // Validate schema
        try {
            await this.validator.validate(event.event_type, event.payload);
        }
        catch (err) {
            console.error("EVENT_VALIDATION_FAILED", {
                event_type: event.event_type,
                source_agent: event.source_agent,
                error: err instanceof Error ? err.message : String(err),
            });
            throw new ValidationError(err instanceof Error ? err.message : "Schema validation failed");
        }
        // Validate identifiers
        try {
            this.validator.validateIdentifiers(event.session_id, event.correlation_id);
        }
        catch (err) {
            throw new ValidationError(err instanceof Error ? err.message : "Invalid identifiers");
        }
        // Validate temporal constraints
        try {
            const lastEvent = await this.getLastEvent();
            this.validator.validateTemporal(event.timestamp, lastEvent?.timestamp);
        }
        catch (err) {
            throw new ValidationError(err instanceof Error ? err.message : "Temporal validation failed");
        }
        // Compute checksum
        const eventWithoutChecksum = {
            id,
            version,
            ...event,
        };
        const checksum = this.integrity.computeChecksum(eventWithoutChecksum);
        const finalEvent = {
            ...eventWithoutChecksum,
            checksum,
        };
        this.writeBuffer.push(finalEvent);
        if (this.writeBuffer.length >= this.writeBufferSize) {
            await this.flush();
        }
        return finalEvent;
    }
    async flush() {
        if (this.writeBuffer.length === 0) {
            return;
        }
        await this.acquireLock();
        try {
            const current = this.readStore();
            const updated = [...current, ...this.writeBuffer];
            const tmpPath = `${this.storePath}.tmp`;
            fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2), "utf8");
            fs.renameSync(tmpPath, this.storePath);
            const fd = fs.openSync(this.storePath, "r");
            fs.fsyncSync(fd);
            fs.closeSync(fd);
            console.log(`✓ Flushed ${updated.length} events to store`);
            this.writeBuffer = [];
        }
        catch (err) {
            throw new WriteError(err instanceof Error ? err.message : "Write failed");
        }
        finally {
            await this.releaseLock();
        }
    }
    async flush_sync() {
        await this.flush();
    }
    readStore() {
        try {
            const content = fs.readFileSync(this.storePath, "utf8");
            const events = JSON.parse(content);
            const validEvents = events.filter((evt) => {
                try {
                    const isValid = this.integrity.validateChecksum(evt);
                    return isValid;
                }
                catch {
                    console.warn("CORRUPTED_EVENT", { event_id: evt.id });
                    return false;
                }
            });
            return validEvents;
        }
        catch (err) {
            console.error("STORE_READ_FAILURE", {
                path: this.storePath,
                error: err instanceof Error ? err.message : String(err),
            });
            throw new WriteError(err instanceof Error ? err.message : "Failed to read store");
        }
    }
    async query(eventType, dateFrom, dateTo) {
        const events = this.readStore();
        return events.filter((evt) => {
            if (eventType && evt.event_type !== eventType)
                return false;
            if (dateFrom && evt.timestamp < dateFrom)
                return false;
            if (dateTo && evt.timestamp > dateTo)
                return false;
            return true;
        });
    }
    async queryRecent(days = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoff = cutoffDate.toISOString();
        return this.query(undefined, cutoff);
    }
    async getLastEvent() {
        const events = this.readStore();
        return events.length > 0 ? events[events.length - 1] : null;
    }
    async acquireLock(maxWaitMs = 30000) {
        const startTime = Date.now();
        while (fs.existsSync(this.lockPath)) {
            if (Date.now() - startTime > maxWaitMs) {
                throw new LockError(`Failed to acquire lock after ${maxWaitMs}ms`);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        fs.writeFileSync(this.lockPath, process.pid.toString(), "utf8");
    }
    async releaseLock() {
        try {
            if (fs.existsSync(this.lockPath)) {
                fs.unlinkSync(this.lockPath);
            }
        }
        catch {
            console.warn("LOCK_RELEASE_FAILED");
        }
    }
    async getStats() {
        const events = this.readStore();
        const by_type = {
            ARPS_DELTA: 0,
            PIPELINE_RUN: 0,
            AGENT_TELEMETRY: 0,
            GOVERNANCE_SIGNAL: 0,
            APR_PLAN: 0,
            CRO_RUN: 0,
        };
        for (const evt of events) {
            by_type[evt.event_type]++;
        }
        const stats = fs.statSync(this.storePath);
        return {
            total_events: events.length,
            by_type,
            oldest_event: events.length > 0 ? events[0].timestamp : null,
            newest_event: events.length > 0 ? events[events.length - 1].timestamp : null,
            store_size_mb: stats.size / (1024 * 1024),
        };
    }
}
//# sourceMappingURL=memory-store.js.map