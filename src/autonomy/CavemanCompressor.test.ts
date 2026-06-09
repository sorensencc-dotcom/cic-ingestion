import {
  cavemanCompress,
  compressJsonResponse,
  compressAutonomyOutput,
} from './CavemanCompressor';

describe('CavemanCompressor', () => {
  describe('cavemanCompress', () => {
    test('removes verbose patterns', () => {
      const verbose = 'The reason why this happens is fundamentally important.';
      const compressed = cavemanCompress(verbose);
      expect(compressed.length).toBeLessThan(verbose.length);
    });

    test('preserves articles before numbers', () => {
      const text = 'Configure the 2FA system. Use a 512-bit key.';
      const result = cavemanCompress(text);
      expect(result).toContain('2FA');
      expect(result).toContain('512');
    });

    test('skips re-compression of already compressed text', () => {
      const compressed = 'code fails bug in function';
      const recompressed = cavemanCompress(compressed, true);
      expect(recompressed).toBe(compressed);
    });

    test('handles empty strings', () => {
      expect(cavemanCompress('')).toBe('');
      expect(cavemanCompress(null as any)).toBe(null);
    });

    test('cleans multiple spaces', () => {
      const text = 'this    has     multiple     spaces';
      const result = cavemanCompress(text);
      expect(result).not.toContain('  ');
    });
  });

  describe('compressJsonResponse', () => {
    test('compresses specified fields in objects', () => {
      const data = {
        id: 'sig-1',
        description:
          'This is a very long description that should be compressed because it contains many words.',
        value: 42,
      };
      const result = compressJsonResponse(data, ['description']);
      expect(result.value).toBe(42);
      expect(result.id).toBe('sig-1');
      expect(result.description.length).toBeLessThanOrEqual(data.description.length);
    });

    test('compresses array elements', () => {
      const data = [
        {
          id: 'sig-1',
          description: 'This is a verbose description with many unnecessary words.',
        },
        {
          id: 'sig-2',
          description: 'Another verbose description that should be compressed.',
        },
      ];
      const result = compressJsonResponse(data, ['description']);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sig-1');
      expect(result[1].id).toBe('sig-2');
    });

    test('ignores non-string fields', () => {
      const data = {
        id: 'sig-1',
        count: 100,
        timestamp: new Date(),
      };
      const result = compressJsonResponse(data, ['count', 'timestamp']);
      expect(result.count).toBe(100);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('handles undefined fieldsToCompress', () => {
      const data = { id: 'sig-1', text: 'This is verbose text.' };
      const result = compressJsonResponse(data, undefined);
      expect(result).toEqual(data);
    });
  });

  describe('compressAutonomyOutput', () => {
    test('compresses signals and proposals', () => {
      const signals = [
        {
          id: 'sig-1',
          type: 'drift',
          severity: 'high',
          description: 'This is a very long description with many unnecessary words.',
        },
      ];
      const proposals = [
        {
          id: 'prop-1',
          action: 'investigate',
          description: 'This proposal recommends investigating the root cause with detailed analysis.',
        },
      ];

      const result = compressAutonomyOutput(signals, proposals);

      expect(result.signals[0].id).toBe('sig-1');
      expect(result.signals[0].type).toBe('drift');
      expect(result.proposals[0].id).toBe('prop-1');
      expect(result.proposals[0].action).toBe('investigate');
    });

    test('returns valid compression stats', () => {
      const signals = [
        {
          description: 'Very verbose text with many words that should be compressed significantly.',
        },
      ];
      const proposals = [
        {
          description: 'Another verbose description that contains filler words and unnecessary text.',
        },
      ];

      const result = compressAutonomyOutput(signals, proposals);

      expect(result.stats.originalLength).toBeGreaterThan(0);
      expect(result.stats.compressedLength).toBeGreaterThan(0);
      expect(result.stats.reductionPercent).toBeGreaterThanOrEqual(0);
      expect(result.stats.timestamp).toBeInstanceOf(Date);
    });

    test('preserves data integrity', () => {
      const signals = [
        { id: 'sig-1', type: 'drift', severity: 'high', description: 'text' },
        { id: 'sig-2', type: 'regression', severity: 'medium', description: 'more text' },
      ];
      const proposals = [{ id: 'prop-1', priority: 1, action: 'investigate', description: 'action' }];

      const result = compressAutonomyOutput(signals, proposals);

      expect(result.signals[0].id).toBe('sig-1');
      expect(result.signals[0].type).toBe('drift');
      expect(result.signals[1].severity).toBe('medium');
      expect(result.proposals[0].priority).toBe(1);
      expect(result.proposals[0].action).toBe('investigate');
    });

    test('handles empty arrays', () => {
      const result = compressAutonomyOutput([], []);
      expect(result.signals).toEqual([]);
      expect(result.proposals).toEqual([]);
      expect(result.stats.reductionPercent).toBeGreaterThanOrEqual(0);
    });
  });
});
