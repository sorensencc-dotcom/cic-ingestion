export function makeSuccess(data, adapter, start) {
    return {
        ok: true,
        data,
        meta: {
            adapter,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString(),
        },
    };
}
export function makeError(code, details, adapter, start) {
    return {
        ok: false,
        error: {
            code,
            message: code,
            details,
        },
        meta: {
            adapter,
            durationMs: Date.now() - start,
            timestamp: new Date().toISOString(),
        },
    };
}
//# sourceMappingURL=envelope.js.map
