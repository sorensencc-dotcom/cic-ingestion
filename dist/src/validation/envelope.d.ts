export interface AdapterError {
    code: string;
    message: string;
    details?: unknown;
}
export interface AdapterResponse<T> {
    ok: boolean;
    data?: T;
    error?: AdapterError;
    meta: {
        adapter: string;
        durationMs: number;
        timestamp: string;
    };
}
export declare function makeSuccess<T>(data: T, adapter: string, start: number): AdapterResponse<T>;
export declare function makeError<T>(code: string, details: unknown, adapter: string, start: number): AdapterResponse<T>;
//# sourceMappingURL=envelope.d.ts.map