import { AdapterRegistry } from "./adapters/AdapterRegistry";
import { BaseAdapter, AdapterConfig, AdapterInput, AdapterOutput } from "./adapters/BaseAdapter";
import { FamilySearchAdapter } from "./adapters/familysearch/FamilySearchAdapter";
import { GrokUnifiedAdapter } from "./adapters/grok/GrokUnifiedAdapter";

import { AdapterIntegrationService, ExecutionResult } from "./services/AdapterIntegrationService";
import { WarmPoolManager, WarmPoolEntry, HydrationState } from "./services/WarmPoolManager";

import { SpaHydrationDetector, HydrationFailure } from "./detectors/SpaHydrationDetector";
import { VerticalDriftDetector, DriftSignal } from "./detectors/VerticalDriftDetector";

import { SLOViolationWebhook, SLOEvent, SLOEventType, SLOWebhookConfig } from "./webhooks/SLOViolationWebhook";

import { createExecuteRouter } from "./routes/execute";

export type {
  AdapterConfig,
  AdapterInput,
  AdapterOutput,
  ExecutionResult,
  WarmPoolEntry,
  HydrationState,
  HydrationFailure,
  DriftSignal,
  SLOEvent,
  SLOEventType,
  SLOWebhookConfig,
};

export {
  AdapterRegistry,
  BaseAdapter,
  FamilySearchAdapter,
  GrokUnifiedAdapter,
  AdapterIntegrationService,
  WarmPoolManager,
  SpaHydrationDetector,
  VerticalDriftDetector,
  SLOViolationWebhook,
  createExecuteRouter,
};
