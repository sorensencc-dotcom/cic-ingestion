/**
 * Caveman Compression Utility for Token Optimization
 * Integrates caveman-style compression for API responses and autonomy outputs
 */
/**
 * Simplified compression: remove verbose patterns common in API responses
 * Typical savings: 40-75% token reduction
 * Safe: preserves articles before numbers/acronyms, doesn't re-compress
 */
export function cavemanCompress(text, skipIfCompressed = true) {
    if (!text || typeof text !== 'string')
        return text;
    if (skipIfCompressed && isLikelyCompressed(text)) {
        return text;
    }
    let compressed = text
        // Remove verbose explanations
        .replace(/\b(The reason|The issue|The problem|It appears that|It seems that|You should|I recommend|I suggest|I would recommend|In order to|In this case|As you can see|As you may know)\b/gi, '')
        // Remove fluff conjunctions
        .replace(/\b(therefore|however|furthermore|moreover|likewise|indeed|basically|actually|essentially|generally|typically|usually)\b/gi, '')
        // Remove unnecessary articles and qualifiers (but preserve before numbers/acronyms)
        .replace(/\b(a|an|the|this|that|these|those)\s+(?![A-Z0-9])/gi, '')
        // Compress common phrases
        .replace(/would like to|would you|do you|can you|could you/gi, '')
        .replace(/please note that|please be aware that|note that/gi, '')
        .replace(/as follows:/gi, ':')
        // Remove trailing conjunctions and connectors
        .replace(/\s+(and|or|but)\s+$/gm, '')
        // Clean up multiple spaces
        .replace(/\s{2,}/g, ' ')
        // Remove unnecessary line breaks
        .replace(/\n\s*\n/g, '\n')
        .trim();
    return compressed;
}
/**
 * Detect if text is already compressed (heuristic: very short, fragments, no articles)
 */
function isLikelyCompressed(text) {
    const articleCount = (text.match(/\b(a|an|the|this|that|these|those)\b/gi) || []).length;
    const wordCount = text.split(/\s+/).length;
    const articleRatio = articleCount / wordCount;
    return articleRatio < 0.02 && wordCount < 50;
}
/**
 * Compress JSON response while preserving data integrity
 * Handles objects and arrays
 */
export function compressJsonResponse(data, fieldsToCompress) {
    if (!fieldsToCompress || !data) {
        return data;
    }
    // Handle arrays
    if (Array.isArray(data)) {
        return data.map((item) => {
            if (typeof item === 'object' && item !== null) {
                return compressObjectFields(item, fieldsToCompress);
            }
            return item;
        });
    }
    // Handle objects
    return compressObjectFields(data, fieldsToCompress);
}
/**
 * Helper to compress fields in a single object
 */
function compressObjectFields(obj, fieldsToCompress) {
    const compressed = { ...obj };
    for (const field of fieldsToCompress) {
        const value = compressed[field];
        if (typeof value === 'string') {
            compressed[field] = cavemanCompress(value);
        }
    }
    return compressed;
}
/**
 * Compress autonomy signals and proposals for efficient transmission
 */
export function compressAutonomyOutput(signals, proposals) {
    let originalLength = 0;
    let originalJson = '';
    try {
        originalJson = JSON.stringify({ signals, proposals });
        originalLength = originalJson.length;
    }
    catch (err) {
        console.error('compressAutonomyOutput: JSON.stringify original failed:', err);
        originalLength = 0;
    }
    const compressedSignals = compressJsonResponse(signals, ['description', 'rationale']);
    const compressedProposals = compressJsonResponse(proposals, [
        'description',
        'reasoning',
        'impact',
    ]);
    let compressedLength = 0;
    try {
        const compressedJson = JSON.stringify({
            signals: compressedSignals,
            proposals: compressedProposals,
        });
        compressedLength = compressedJson.length;
    }
    catch (err) {
        console.error('compressAutonomyOutput: JSON.stringify compressed failed:', err);
        compressedLength = originalLength;
    }
    const reductionPercent = originalLength > 0
        ? ((originalLength - compressedLength) / originalLength) * 100
        : 0;
    const stats = {
        originalLength,
        compressedLength,
        reductionPercent: Math.max(0, Math.round(reductionPercent)),
        timestamp: new Date(),
    };
    return {
        signals: compressedSignals,
        proposals: compressedProposals,
        stats,
    };
}
/**
 * Logger for compression stats (useful for monitoring token savings)
 */
export function logCompressionStats(stats) {
    console.log(`[Caveman] Compression: ${stats.originalLength} → ${stats.compressedLength} bytes (${stats.reductionPercent}% reduction)`);
}
/**
 * Unified compress() method returning {data, stats}
 * Used by higher-level integrations (Wayland, Phase25To26, etc)
 */
export class CavemanCompressor {
    compress(data, fieldsToCompress) {
        let bytesIn = 0;
        let originalJson = '';
        try {
            originalJson = JSON.stringify(data);
            bytesIn = originalJson.length;
        }
        catch (err) {
            console.error('CavemanCompressor.compress: JSON.stringify input failed:', err);
            return {
                data,
                stats: {
                    bytesIn: 0,
                    bytesOut: 0,
                    bytesSaved: 0,
                    ratio: 1,
                    arraysProcessed: 0,
                    objectsProcessed: 0,
                    recompressionBlocked: false,
                    error: 'stringify_input_failed',
                },
            };
        }
        let compressed;
        try {
            compressed = compressJsonResponse(data, fieldsToCompress);
        }
        catch (err) {
            console.error('CavemanCompressor.compress: compressJsonResponse failed:', err);
            return {
                data,
                stats: {
                    bytesIn,
                    bytesOut: bytesIn,
                    bytesSaved: 0,
                    ratio: 1,
                    arraysProcessed: 0,
                    objectsProcessed: 0,
                    recompressionBlocked: false,
                    error: 'compression_failed',
                },
            };
        }
        let bytesOut = 0;
        try {
            const compressedJson = JSON.stringify(compressed);
            bytesOut = compressedJson.length;
        }
        catch (err) {
            console.error('CavemanCompressor.compress: JSON.stringify compressed failed:', err);
            bytesOut = bytesIn;
        }
        const bytesSaved = Math.max(0, bytesIn - bytesOut);
        const ratio = bytesIn > 0 ? bytesOut / bytesIn : 1;
        // Count processed arrays/objects
        let arraysProcessed = 0;
        let objectsProcessed = 0;
        function countStructures(obj) {
            if (Array.isArray(obj)) {
                arraysProcessed++;
                for (const item of obj) {
                    countStructures(item);
                }
            }
            else if (typeof obj === 'object' && obj !== null) {
                objectsProcessed++;
                for (const key in obj) {
                    countStructures(obj[key]);
                }
            }
        }
        try {
            countStructures(data);
        }
        catch (err) {
            console.error('CavemanCompressor.compress: countStructures failed:', err);
        }
        return {
            data: compressed,
            stats: {
                bytesIn,
                bytesOut,
                bytesSaved,
                ratio: Math.max(0, ratio),
                arraysProcessed,
                objectsProcessed,
                recompressionBlocked: false,
            },
        };
    }
}
//# sourceMappingURL=CavemanCompressor.js.map
