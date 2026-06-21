/**
 * CavemanStats Schema v1.0
 * Standard compression telemetry across CIC architecture
 */
export function createCavemanStats(bytesIn, bytesOut, context = {}) {
    const bytesSaved = bytesIn - bytesOut;
    const ratio = bytesIn > 0 ? bytesOut / bytesIn : 1;
    return {
        schema_version: '1.0',
        bytes_in: bytesIn,
        bytes_out: bytesOut,
        bytes_saved: Math.max(0, bytesSaved),
        ratio: Math.max(0, ratio),
        arrays_processed: context.arrays_processed ?? 0,
        objects_processed: context.objects_processed ?? 0,
        recompression_blocked: context.recompression_blocked ?? false,
        compression_error: context.compression_error,
        pipeline_stage: context.pipeline_stage ?? 'unknown',
        tool_id: context.tool_id,
        phase_id: context.phase_id,
        agent_id: context.agent_id,
        timestamp: Date.now(),
        hash: context.hash,
    };
}
export function logCavemanStats(label, stats) {
    console.log(`[Caveman:${stats.pipeline_stage}] ${label}: ${stats.bytes_in}→${stats.bytes_out} bytes ` +
        `(${Math.round(stats.ratio * 100)}% output, ${Math.round((1 - stats.ratio) * 100)}% saved)`);
}
export function validateCavemanStats(stats) {
    return (stats.schema_version === '1.0' &&
        typeof stats.bytes_in === 'number' &&
        typeof stats.bytes_out === 'number' &&
        typeof stats.bytes_saved === 'number' &&
        typeof stats.ratio === 'number' &&
        typeof stats.timestamp === 'number' &&
        stats.bytes_in >= 0 &&
        stats.bytes_out >= 0 &&
        stats.bytes_saved >= 0 &&
        stats.ratio >= 0 &&
        stats.ratio <= 1);
}
//# sourceMappingURL=CavemanStats.js.map
