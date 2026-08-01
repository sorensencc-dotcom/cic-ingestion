import { describe, expect, it } from '@jest/globals';
import { extractorMap } from './index';

describe('harvester extractor map', () => {
  it('registers client_session and produces a stable result for partial input', async () => {
    expect(extractorMap.client_session).toBeDefined();
    await expect(extractorMap.client_session({ type: 'client_session', timestamp: 1, backend: 'api' } as any))
      .resolves.toMatchObject({ type: 'client_session', backend: 'api', timestamp: 1, latency_ms: null, tokens: null });
  });

  it('is deterministic for repeated harvesting of the same source', async () => {
    const entry = { type: 'client_session', timestamp: 1, backend: 'api', response: { meta: { latency_ms: 4 }, usage: { total_tokens: 8 } } };
    const first = await extractorMap.client_session(entry);
    const second = await extractorMap.client_session(entry);
    expect(second).toEqual(first);
  });
});
