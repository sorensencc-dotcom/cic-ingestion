import Ajv from "ajv";
import * as fs from "fs";
import * as path from "path";
import { ValidationError, TemporalError } from "../store/memory-store.errors";
export class MemoryValidator {
    constructor() {
        this.schemas = {};
        this.ajv = new Ajv({ strict: false, useDefaults: false });
        this.loadSchemas();
    }
    loadSchemas() {
        const schemaDir = path.join(__dirname, "schemas");
        const eventTypes = [
            "arps-delta",
            "pipeline-run",
            "agent-telemetry",
            "governance-signal",
            "apr-plan",
            "cro-run",
        ];
        for (const type of eventTypes) {
            const schemaPath = path.join(schemaDir, `${type}.schema.json`);
            if (fs.existsSync(schemaPath)) {
                const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
                this.schemas[type] = schema;
            }
        }
    }
    async validate(eventType, payload) {
        const schemaKey = eventType.toLowerCase().replace(/_/g, "-");
        const schema = this.schemas[schemaKey];
        if (!schema) {
            throw new ValidationError(`Unknown event type: ${eventType}`);
        }
        const validate = this.ajv.compile(schema);
        const valid = validate(payload);
        if (!valid) {
            const errors = validate.errors || [];
            const errorMsg = errors
                .map((e) => `${e.instancePath || "root"}: ${e.message}`)
                .join("; ");
            throw new ValidationError(`Schema validation failed: ${errorMsg}`);
        }
    }
    validateTemporal(timestamp, lastTimestamp) {
        try {
            const ts = new Date(timestamp).getTime();
            if (isNaN(ts)) {
                throw new TemporalError(`Invalid ISO8601 timestamp: ${timestamp}`);
            }
            const now = Date.now();
            const fiveSecondsAhead = now + 5000;
            if (ts > fiveSecondsAhead) {
                throw new TemporalError(`Future timestamp too far ahead: ${timestamp}`);
            }
            if (lastTimestamp) {
                const lastTs = new Date(lastTimestamp).getTime();
                if (ts < lastTs) {
                    throw new TemporalError(`Timestamp before previous event: ${timestamp} < ${lastTimestamp}`);
                }
            }
        }
        catch (err) {
            if (err instanceof TemporalError)
                throw err;
            throw new TemporalError(err instanceof Error ? err.message : "Temporal validation failed");
        }
    }
    validateIdentifiers(session_id, correlation_id) {
        const sessionPattern = /^session_\d{8}_\d{3,}$/;
        const correlationPattern = /^corr_[a-z0-9]{6,}$/;
        if (!sessionPattern.test(session_id)) {
            throw new ValidationError(`Invalid session_id format: ${session_id}. Expected: session_YYYYMMDD_NNN`);
        }
        if (!correlationPattern.test(correlation_id)) {
            throw new ValidationError(`Invalid correlation_id format: ${correlation_id}. Expected: corr_XXXXX`);
        }
    }
}
//# sourceMappingURL=memory-validator.js.map