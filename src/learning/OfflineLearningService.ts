import { PolicyNetwork } from 'src/learning/policy/PolicyNetwork.js';

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
