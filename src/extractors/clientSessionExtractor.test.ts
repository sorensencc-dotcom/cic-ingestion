import { describe, it, expect } from '@jest/globals';
import { clientSessionExtractor, ClientSessionEntry } from './clientSessionExtractor';

describe('clientSessionExtractor', () => {
  it('extracts session metadata correctly', async () => {
    const entry: ClientSessionEntry = {
      type: 'raw_session',
      timestamp: 1718000000000,
      backend: 'gpt-4o',
      request: { prompt: 'hello' },
      response: {
        usage: { total_tokens: 150 },
        meta: { latency_ms: 250 },
      },
    };

    const result = await clientSessionExtractor(entry);

    expect(result.type).toBe('client_session');
    expect(result.backend).toBe('gpt-4o');
    expect(result.latency_ms).toBe(250);
    expect(result.tokens).toBe(150);
    expect(result.timestamp).toBe(1718000000000);
    expect(result.driftSignals.latency).toBe(250);
    expect(result.driftSignals.tokens).toBe(150);
    expect(result.driftSignals.backend).toBe('gpt-4o');
  });

  it('handles missing response metadata gracefully by returning nulls', async () => {
    const entry: ClientSessionEntry = {
      type: 'raw_session',
      timestamp: 1718000000000,
      backend: 'llama3',
      request: {},
      response: {}, // empty
    };

    const result = await clientSessionExtractor(entry);

    expect(result.latency_ms).toBeNull();
    expect(result.tokens).toBeNull();
    expect(result.driftSignals.latency).toBeUndefined();
    expect(result.driftSignals.tokens).toBeUndefined();
  });
});
