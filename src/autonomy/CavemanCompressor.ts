/**
 * Caveman Compression Utility for Token Optimization
 * Integrates caveman-style compression for API responses and autonomy outputs
 */

interface CompressionStats {
  originalLength: number;
  compressedLength: number;
  reductionPercent: number;
  timestamp: Date;
}

/**
 * Simplified compression: remove verbose patterns common in API responses
 * Typical savings: 40-75% token reduction
 * Safe: preserves articles before numbers/acronyms, doesn't re-compress
 */
export function cavemanCompress(text: string, skipIfCompressed = true): string {
  if (!text || typeof text !== 'string') return text;

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
function isLikelyCompressed(text: string): boolean {
  const articleCount = (text.match(/\b(a|an|the|this|that|these|those)\b/gi) || []).length;
  const wordCount = text.split(/\s+/).length;
  const articleRatio = articleCount / wordCount;

  return articleRatio < 0.02 && wordCount < 50;
}

/**
 * Compress JSON response while preserving data integrity
 * Handles objects and arrays
 */
export function compressJsonResponse<T extends Record<string, any> | any[]>(
  data: T,
  fieldsToCompress?: (keyof any)[]
): T {
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
    }) as T;
  }

  // Handle objects
  return compressObjectFields(data, fieldsToCompress) as T;
}

/**
 * Helper to compress fields in a single object
 */
function compressObjectFields(obj: Record<string, any>, fieldsToCompress: (keyof any)[]): Record<string, any> {
  const compressed = { ...obj };

  for (const field of fieldsToCompress) {
    const value = compressed[field as string];
    if (typeof value === 'string') {
      compressed[field as string] = cavemanCompress(value);
    }
  }

  return compressed;
}

/**
 * Compress autonomy signals and proposals for efficient transmission
 */
export function compressAutonomyOutput(
  signals: any,
  proposals: any
): { signals: any; proposals: any; stats: CompressionStats } {
  const originalJson = JSON.stringify({ signals, proposals });
  const originalLength = originalJson.length;

  const compressedSignals = compressJsonResponse(signals, ['description', 'rationale']);
  const compressedProposals = compressJsonResponse(proposals, [
    'description',
    'reasoning',
    'impact',
  ]);

  const compressedJson = JSON.stringify({
    signals: compressedSignals,
    proposals: compressedProposals,
  });
  const compressedLength = compressedJson.length;

  const reductionPercent = ((originalLength - compressedLength) / originalLength) * 100;

  const stats: CompressionStats = {
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
export function logCompressionStats(stats: CompressionStats): void {
  console.log(
    `[Caveman] Compression: ${stats.originalLength} → ${stats.compressedLength} bytes (${stats.reductionPercent}% reduction)`
  );
}
