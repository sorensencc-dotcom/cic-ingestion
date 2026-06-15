import { EventType } from "../store/memory-store.types";
export declare class MemoryValidator {
    private ajv;
    private schemas;
    constructor();
    private loadSchemas;
    validate(eventType: EventType, payload: any): Promise<void>;
    validateTemporal(timestamp: string, lastTimestamp?: string): void;
    validateIdentifiers(session_id: string, correlation_id: string): void;
}
//# sourceMappingURL=memory-validator.d.ts.map