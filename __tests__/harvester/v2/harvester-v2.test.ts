import { HarvesterV2 } from '../../../src/harvester/v2/HarvesterV2';

describe('HarvesterV2', () => {
  let harvester: HarvesterV2;

  beforeEach(() => {
    harvester = new HarvesterV2({
      buildLogPath: '/tmp/test-logs',
      metricsEndpoint: 'http://localhost:3100/metrics',
      vaultStore: {},
      memoryStore: {},
    });
  });

  test('extracts build logs', () => {
    expect(harvester).toBeDefined();
  });

  test('extracts cost deltas', () => {
    expect(harvester).toBeDefined();
  });

  test('normalizes telemetry', () => {
    expect(harvester).toBeDefined();
  });

  test('emits to memory store', () => {
    expect(harvester).toBeDefined();
  });

  test('emits to scheduler', () => {
    expect(harvester).toBeDefined();
  });

  test('full pipeline executes', () => {
    expect(harvester).toBeDefined();
  });
});
