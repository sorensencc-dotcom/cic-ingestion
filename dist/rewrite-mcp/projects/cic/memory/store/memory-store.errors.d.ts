export declare class MemoryStoreError extends Error {
    code: string;
    constructor(message: string, code: string);
}
export declare class ValidationError extends MemoryStoreError {
    constructor(message: string);
}
export declare class IntegrityError extends MemoryStoreError {
    constructor(message: string);
}
export declare class TemporalError extends MemoryStoreError {
    constructor(message: string);
}
export declare class LockError extends MemoryStoreError {
    constructor(message: string);
}
export declare class WriteError extends MemoryStoreError {
    constructor(message: string);
}
//# sourceMappingURL=memory-store.errors.d.ts.map