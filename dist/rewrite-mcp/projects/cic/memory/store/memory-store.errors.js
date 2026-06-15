export class MemoryStoreError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "MemoryStoreError";
    }
}
export class ValidationError extends MemoryStoreError {
    constructor(message) {
        super(message, "VALIDATION_ERROR");
        this.name = "ValidationError";
    }
}
export class IntegrityError extends MemoryStoreError {
    constructor(message) {
        super(message, "INTEGRITY_ERROR");
        this.name = "IntegrityError";
    }
}
export class TemporalError extends MemoryStoreError {
    constructor(message) {
        super(message, "TEMPORAL_ERROR");
        this.name = "TemporalError";
    }
}
export class LockError extends MemoryStoreError {
    constructor(message) {
        super(message, "LOCK_ERROR");
        this.name = "LockError";
    }
}
export class WriteError extends MemoryStoreError {
    constructor(message) {
        super(message, "WRITE_ERROR");
        this.name = "WriteError";
    }
}
//# sourceMappingURL=memory-store.errors.js.map