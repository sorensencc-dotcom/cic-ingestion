import { decayDriftScores, updateDriftScores } from './driftEngine.ts';

describe('drift score engine', () => {
  it('initializes backend and applies latency/token penalties', () => {
    const state: Record<string, number> = {};
    updateDriftScores({ driftSignals: { backend: 'local', latency: 1600, tokens: 4000 } }, state);
    expect(state).toEqual({ local: 0.6 });
  });

  it('caps accumulated score and decays small values to zero', () => {
    const state = { remote: 0.9 };
    updateDriftScores({ driftSignals: { backend: 'remote', latency: 1600, tokens: 4000 } }, state);
    expect(state.remote).toBe(1);
    decayDriftScores(state, 0.001);
    expect(state.remote).toBe(0);
  });
});
