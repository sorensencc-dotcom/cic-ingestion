/**
 * Text canonicalization for deterministic prompt caching
 * Normalizes documents to ensure same content → same hash
 */
export declare function canonicalize(text: string): string;
/**
 * SHA-256 hash of canonical text (deterministic)
 */
export declare function computeHash(text: string): Promise<string>;
/**
 * Estimate token count (rough heuristic: 1 token ≈ 4 chars)
 * For production, use tokenizer library
 */
export declare function estimateTokens(text: string): number;
//# sourceMappingURL=canonicalize.d.ts.map