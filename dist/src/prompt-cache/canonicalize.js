/**
 * Text canonicalization for deterministic prompt caching
 * Normalizes documents to ensure same content → same hash
 */
export function canonicalize(text) {
    // NFKC normalization (compatibility decomposition + canonical composition)
    let normalized = text.normalize('NFKC');
    // Collapse all whitespace (including newlines/tabs) to single space
    normalized = normalized.replace(/\s+/g, ' ');
    // Remove remaining control characters
    normalized = normalized
        .split('')
        .filter((c) => c.charCodeAt(0) >= 32)
        .join('');
    return normalized.trim();
}
/**
 * SHA-256 hash of canonical text (deterministic)
 */
export async function computeHash(text) {
    const canonical = canonicalize(text);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
/**
 * Estimate token count (rough heuristic: 1 token ≈ 4 chars)
 * For production, use tokenizer library
 */
export function estimateTokens(text) {
    return Math.ceil(text.split(/\s+/).length * 1.3);
}
//# sourceMappingURL=canonicalize.js.map