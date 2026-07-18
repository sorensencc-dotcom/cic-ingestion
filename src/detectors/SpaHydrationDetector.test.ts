import { describe, it, expect } from '@jest/globals';
import { SpaHydrationDetector } from './SpaHydrationDetector';
import { AdapterOutput } from '../adapters/BaseAdapter';

describe('SpaHydrationDetector', () => {
  const detector = new SpaHydrationDetector();

  it('detects null result as high severity failure', () => {
    const failure = detector.check(null as any);
    expect(failure).toBeDefined();
    expect(failure?.reason).toBe('null result');
    expect(failure?.severity).toBe('HIGH');
  });

  it('detects missing hydration metadata as medium severity', () => {
    const output: AdapterOutput = {
      success: true,
      timestamp: Date.now(),
    };
    const failure = detector.check(output);
    expect(failure).toBeDefined();
    expect(failure?.reason).toBe('missing hydration metadata');
    expect(failure?.severity).toBe('MEDIUM');
  });

  it('detects hydration errors as high severity', () => {
    const output: AdapterOutput = {
      success: true,
      timestamp: Date.now(),
      hydration: {
        cached: false,
        timestamp: Date.now(),
        errors: ['DOM mismatch', 'missing element'],
      },
    };
    const failure = detector.check(output);
    expect(failure).toBeDefined();
    expect(failure?.reason).toBe('hydration errors detected');
    expect(failure?.severity).toBe('HIGH');
    expect(failure?.details).toContain('DOM mismatch');
  });

  it('detects execution failure as high severity', () => {
    const output: AdapterOutput = {
      success: false,
      error: 'network timeout',
      timestamp: Date.now(),
      hydration: {
        cached: false,
        timestamp: Date.now(),
      },
    };
    const failure = detector.check(output);
    expect(failure).toBeDefined();
    expect(failure?.reason).toBe('adapter execution failed');
    expect(failure?.severity).toBe('HIGH');
    expect(failure?.details).toBe('network timeout');
  });

  it('detects low confidence score as medium severity', () => {
    const output: AdapterOutput = {
      success: true,
      score: 0.25, // less than threshold 0.3
      timestamp: Date.now(),
      hydration: {
        cached: false,
        timestamp: Date.now(),
      },
    };
    const failure = detector.check(output);
    expect(failure).toBeDefined();
    expect(failure?.reason).toBe('low confidence score');
    expect(failure?.severity).toBe('MEDIUM');
    expect(failure?.details?.score).toBe(0.25);
  });

  it('returns null on a healthy output', () => {
    const output: AdapterOutput = {
      success: true,
      score: 0.95,
      timestamp: Date.now(),
      hydration: {
        cached: false,
        timestamp: Date.now(),
      },
    };
    const failure = detector.check(output);
    expect(failure).toBeNull();
  });

  it('processes batch results correctly', () => {
    const batch: AdapterOutput[] = [
      {
        success: true,
        score: 0.9,
        timestamp: Date.now(),
        hydration: { cached: false, timestamp: Date.now() },
      },
      {
        success: true,
        score: 0.1, // fail
        timestamp: Date.now(),
        hydration: { cached: false, timestamp: Date.now() },
      },
    ];

    const failures = detector.checkBatch(batch);
    expect(failures.length).toBe(1);
    expect(failures[0].reason).toBe('low confidence score');
  });
});
