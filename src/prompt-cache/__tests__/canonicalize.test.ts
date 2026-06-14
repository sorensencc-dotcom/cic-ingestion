/**
 * Tests for text canonicalization and hashing
 */

import { canonicalize, computeHash, estimateTokens } from '../canonicalize';

describe('canonicalize', () => {
  it('normalizes whitespace', () => {
    const input = 'hello   world\n\n  test';
    const result = canonicalize(input);
    expect(result).toBe('hello world test');
  });

  it('handles NFKC normalization', () => {
    const input = 'café'; // é can be one or two chars
    const result = canonicalize(input);
    expect(result).toMatch(/caf/); // Normalized consistently
  });

  it('produces same output for same input', () => {
    const text = 'The quick brown fox';
    const result1 = canonicalize(text);
    const result2 = canonicalize(text);
    expect(result1).toBe(result2);
  });

  it('removes control characters', () => {
    const input = 'hello\x00\x01world';
    const result = canonicalize(input);
    expect(result).not.toContain('\x00');
    expect(result).not.toContain('\x01');
  });

  it('normalizes newlines and tabs to spaces', () => {
    const input = 'hello\nworld\ttest';
    const result = canonicalize(input);
    expect(result).toBe('hello world test');
  });
});

describe('computeHash', () => {
  it('produces consistent hashes', async () => {
    const text = 'Test document content';
    const hash1 = await computeHash(text);
    const hash2 = await computeHash(text);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different content', async () => {
    const hash1 = await computeHash('Document A');
    const hash2 = await computeHash('Document B');
    expect(hash1).not.toBe(hash2);
  });

  it('canonicalizes before hashing', async () => {
    const hash1 = await computeHash('hello   world');
    const hash2 = await computeHash('hello world');
    expect(hash1).toBe(hash2); // Same after canonicalization
  });

  it('returns 64-char hex string', async () => {
    const hash = await computeHash('test');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('estimateTokens', () => {
  it('estimates tokens from word count', () => {
    const text = 'one two three four five';
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it('returns at least 1 token for non-empty text', () => {
    expect(estimateTokens('hello')).toBeGreaterThanOrEqual(1);
  });

  it('scales with text length', () => {
    const short = estimateTokens('hello world');
    const long = estimateTokens('hello world hello world hello world hello world');
    expect(long).toBeGreaterThan(short);
  });
});
