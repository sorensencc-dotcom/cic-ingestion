import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OfflineLearningService, OfflineLearningServiceConfig } from '../../src/learning/OfflineLearningService';
import { PolicyNetwork } from '../../src/learning/policy/PolicyNetwork';

class MockPolicyNetwork implements PolicyNetwork {
  constructor(public readonly version: string) {}

  async predict(state: any): Promise<any> {
    return { action: 'route_fast', confidence: 0.95 };
  }
}

class TestOfflineLearningService implements OfflineLearningService {
  private config?: OfflineLearningServiceConfig;
  private currentPolicy: PolicyNetwork;
  private pollTimer: NodeJS.Timeout | null = null;
  private trainingTimer: NodeJS.Timeout | null = null;
  public trainingRunsCount = 0;
  public eventsObserved = 0;

  constructor() {
    this.currentPolicy = new MockPolicyNetwork('π_v0');
  }

  start(config: OfflineLearningServiceConfig): void {
    this.config = config;

    this.pollTimer = setInterval(() => {
      this.eventsObserved += 500;
      if (this.eventsObserved >= (this.config?.minLedgerEventsPerTraining || 1000)) {
        this.trainNewPolicy();
      }
    }, config.ledgerPollIntervalMs);

    this.trainingTimer = setInterval(() => {
      this.trainNewPolicy();
    }, config.trainingCadenceMs);
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.trainingTimer) clearInterval(this.trainingTimer);
  }

  trainNewPolicy(): PolicyNetwork {
    this.trainingRunsCount++;
    this.eventsObserved = 0;
    const newVersion = `π_v${this.trainingRunsCount}`;
    this.currentPolicy = new MockPolicyNetwork(newVersion);
    return this.currentPolicy;
  }

  getCurrentPolicy(): PolicyNetwork {
    return this.currentPolicy;
  }
}

describe('Phase 2 E2E Learning Daemon Loop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('verifies that the learning daemon triggers training periodically', async () => {
    const service = new TestOfflineLearningService();

    // Verify initial policy version
    let currentPolicy = service.getCurrentPolicy() as MockPolicyNetwork;
    expect(currentPolicy.version).toBe('π_v0');

    // Start daemon
    service.start({
      ledgerPollIntervalMs: 1000,
      trainingCadenceMs: 5000,
      minLedgerEventsPerTraining: 1000,
    });

    // 1. Advance timer by 2000ms -> should trigger pollTimer twice -> 1000 events -> triggers training!
    await jest.advanceTimersByTimeAsync(2000);
    expect(service.trainingRunsCount).toBe(1);
    currentPolicy = service.getCurrentPolicy() as MockPolicyNetwork;
    expect(currentPolicy.version).toBe('π_v1');

    // 2. Advance timer by 5000ms -> trainingCadenceMs triggers training again!
    await jest.advanceTimersByTimeAsync(5000);
    expect(service.trainingRunsCount).toBe(4);
    currentPolicy = service.getCurrentPolicy() as MockPolicyNetwork;
    expect(currentPolicy.version).toBe('π_v4');

    // Stop daemon
    service.stop();
  });
});
