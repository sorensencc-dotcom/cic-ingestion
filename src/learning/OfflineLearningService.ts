import { PolicyNetwork } from '../../cic-os/src/learning/policy/PolicyNetwork';

export interface OfflineLearningServiceConfig {
  ledgerPollIntervalMs: number;
  trainingCadenceMs: number;
  minLedgerEventsPerTraining: number;
}

export interface OfflineLearningService {
  start(config: OfflineLearningServiceConfig): void;
  stop(): void;
  trainNewPolicy(): PolicyNetwork;
  getCurrentPolicy(): PolicyNetwork;
}
