/**
 * Tests for ConfigValidator
 */

import { validateConfig } from '../ConfigValidator.js';
import { describe, it, expect } from '@jest/globals';

describe('ConfigValidator', () => {
  const validConfig = {
    services: {
      kg: {
        sqlitePath: './data/kg.db',
        ingestBatchSize: 50,
        maxLagMs: 5000,
      },
      torquequery: {
        url: 'http://torquequery:8080',
        backfillHours: 48,
      },
    },
  };

  it('accepts valid config', () => {
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  it('rejects missing required field', () => {
    const invalidConfig = {
      services: {
        kg: {
          sqlitePath: './data/kg.db',
          // missing ingestBatchSize
          maxLagMs: 5000,
        },
        torquequery: {
          url: 'http://torquequery:8080',
          backfillHours: 48,
        },
      },
    };

    expect(() => validateConfig(invalidConfig)).toThrow(/validation failed/);
  });

  it('rejects wrong type', () => {
    const invalidConfig = {
      services: {
        kg: {
          sqlitePath: './data/kg.db',
          ingestBatchSize: 'not-a-number', // should be number
          maxLagMs: 5000,
        },
        torquequery: {
          url: 'http://torquequery:8080',
          backfillHours: 48,
        },
      },
    };

    expect(() => validateConfig(invalidConfig)).toThrow(/validation failed/);
  });
});
