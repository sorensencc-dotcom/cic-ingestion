import { describe, it, expect } from '@jest/globals';
import { VerticalDriftDetector } from './VerticalDriftDetector';
import { AdapterOutput } from '../adapters/BaseAdapter';

describe('VerticalDriftDetector', () => {
  it('detects null result as critical NULL_RESULT', () => {
    const detector = new VerticalDriftDetector();
    const signal = detector.check(null as any);
    expect(signal).toBeDefined();
    expect(signal?.type).toBe('NULL_RESULT');
    expect(signal?.severity).toBe('CRITICAL');
  });

  it('detects execution failure as TIMEOUT', () => {
    const detector = new VerticalDriftDetector();
    const output: AdapterOutput = {
      success: false,
      error: 'timeout error',
      timestamp: 1000,
    };
    const signal = detector.check(output);
    expect(signal).toBeDefined();
    expect(signal?.type).toBe('TIMEOUT');
    expect(signal?.severity).toBe('HIGH');
    expect(signal?.details?.error).toBe('timeout error');
  });

  it('detects confidence drop under threshold', () => {
    const detector = new VerticalDriftDetector();
    
    // Score 0.4: under 0.5 threshold -> HIGH severity
    const output1: AdapterOutput = {
      success: true,
      score: 0.4,
      timestamp: 1000,
    };
    const signal1 = detector.check(output1);
    expect(signal1?.type).toBe('CONFIDENCE_DROP');
    expect(signal1?.severity).toBe('HIGH');

    // Score 0.15: under 0.2 -> CRITICAL severity
    const output2: AdapterOutput = {
      success: true,
      score: 0.15,
      timestamp: 1000,
    };
    const signal2 = detector.check(output2);
    expect(signal2?.type).toBe('CONFIDENCE_DROP');
    expect(signal2?.severity).toBe('CRITICAL');
  });

  it('establishes baseline and detects schema mismatch drift', () => {
    const detector = new VerticalDriftDetector();
    const adapterId = 'adapter-1';

    // First check establishes baseline score of 0.8
    const output1: AdapterOutput = {
      success: true,
      score: 0.8,
      timestamp: 1000,
    };
    const signal1 = detector.check(output1, adapterId);
    expect(signal1).toBeNull();
    expect(detector.getBaseline(adapterId)).toBe(0.8);

    // Second check with score 0.75: drift is |0.75 - 0.8| / 0.8 = 0.0625 (6.25% <= 30%) -> no drift signal
    const output2: AdapterOutput = {
      success: true,
      score: 0.75,
      timestamp: 1000,
    };
    const signal2 = detector.check(output2, adapterId);
    expect(signal2).toBeNull();

    // Third check with score 0.55: drift is |0.55 - 0.75| / 0.75 = 0.266 (26.6% <= 30%) -> no drift signal
    // Wait! Note that baseline is updated to 0.75 after the second check!
    // Let's verify what score was set as baseline:
    expect(detector.getBaseline(adapterId)).toBe(0.75);

    // Now we check with score 0.51: drift is |0.51 - 0.75| / 0.75 = 0.32 (32% > 30%) -> SCHEMA_MISMATCH!
    const output3: AdapterOutput = {
      success: true,
      score: 0.51,
      timestamp: 1000,
    };
    const signal3 = detector.check(output3, adapterId);
    expect(signal3?.type).toBe('SCHEMA_MISMATCH');
    expect(signal3?.severity).toBe('MEDIUM');
    expect(signal3?.details?.drift).toBe('32.00%');
  });

  it('manages baseline registry correctly', () => {
    const detector = new VerticalDriftDetector();
    const adapterId = 'adapter-A';

    detector.check({ success: true, score: 0.9, timestamp: 1000 }, adapterId);
    expect(detector.getBaseline(adapterId)).toBe(0.9);

    detector.resetBaseline(adapterId);
    expect(detector.getBaseline(adapterId)).toBeNull();

    detector.check({ success: true, score: 0.8, timestamp: 1000 }, adapterId);
    detector.clearBaselines();
    expect(detector.getBaseline(adapterId)).toBeNull();
  });
});
