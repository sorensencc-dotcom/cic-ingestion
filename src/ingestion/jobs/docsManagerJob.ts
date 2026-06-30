// C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerJob.ts

import * as fs from "fs";
import * as path from "path";

// === Type Definitions (from spec) ===

type DocsManagerEvent = AuditEvent | DriftEvent | SyncEvent | ConsolidationEvent;

interface AuditEvent {
  schemaVersion: "1.0.0";
  type: "audit";
  timestamp: number;
  sequenceId: number;
  docId: string;
  path: string;
  severity: "info" | "warning" | "error";
  category: "schema" | "format" | "reference" | "coverage";
  message: string;
  details?: {
    expectedSchema?: string;
    actualValue?: string;
    suggestedFix?: string;
  };
}

interface DriftEvent {
  schemaVersion: "1.0.0";
  type: "drift";
  timestamp: number;
  sequenceId: number;
  docId: string;
  specId: string;
  path: string;
  driftType: "semantic" | "structural" | "reference";
  similarityScore: number;
  threshold: number;
  breached: boolean;
  changes?: string[];
}

interface SyncEvent {
  schemaVersion: "1.0.0";
  type: "sync";
  timestamp: number;
  sequenceId: number;
  docId: string;
  syncType: "refresh" | "promotion" | "rollback";
  fromVersion: string;
  toVersion: string;
  path: string;
  status: "initiated" | "in_progress" | "success" | "failed";
  duration?: number;
  errorMessage?: string;
  metadata?: {
    approverIds?: string[];
    changeLog?: string;
    rollbackOf?: number;
  };
}

interface ConsolidationEvent {
  schemaVersion: "1.0.0";
  type: "consolidation";
  timestamp: number;
  sequenceId: number;
  consolidationId: string;
  sourceDocIds: string[];
  targetDocId: string;
  status: "initiated" | "in_progress" | "success" | "failed";
  duration?: number;
  mergeStrategy: "semantic" | "structural" | "manual";
  conflictCount?: number;
  metadata?: {
    rationale?: string;
    approverIds?: string[];
    errorDetails?: string;
  };
}

// === State Management ===

interface DocsManagerState {
  lastSeenSequenceId: number;
  lastProcessedTimestamp: number;
  lastUpdated: string;
  eventsProcessed: number;
  eventsSkipped: number;
}

const STATE_FILE = path.join(
  process.cwd(),
  "cic-ingestion",
  "state",
  "docs_manager_state.json"
);

const JSONL_PATH = path.join(
  process.cwd(),
  "cic-ingestion",
  "logs",
  "docs_manager.jsonl"
);

function loadState(): DocsManagerState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn(`Failed to load docs_manager state: ${err}`);
  }

  return {
    lastSeenSequenceId: 0,
    lastProcessedTimestamp: 0,
    lastUpdated: new Date().toISOString(),
    eventsProcessed: 0,
    eventsSkipped: 0,
  };
}

function saveState(state: DocsManagerState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    state.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.error(`Failed to save docs_manager state: ${err}`);
  }
}

// === Validation ===

function validateEvent(event: any): { valid: boolean; error?: string } {
  if (typeof event !== "object" || event === null) {
    return { valid: false, error: "Event is not an object" };
  }

  if (event.schemaVersion !== "1.0.0") {
    return { valid: false, error: "Invalid or missing schemaVersion" };
  }

  const validTypes = ["audit", "drift", "sync", "consolidation"];
  if (!validTypes.includes(event.type)) {
    return { valid: false, error: `Invalid event type: ${event.type}` };
  }

  if (typeof event.timestamp !== "number" || event.timestamp <= 0) {
    return { valid: false, error: "Invalid or missing timestamp" };
  }

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (Math.abs(event.timestamp - now) > oneDayMs) {
    return { valid: false, error: "Timestamp outside ±1 day window" };
  }

  if (typeof event.sequenceId !== "number" || event.sequenceId <= 0) {
    return { valid: false, error: "Invalid or missing sequenceId" };
  }

  // Type-specific validation
  if (event.type === "audit") {
    if (!["info", "warning", "error"].includes(event.severity)) {
      return { valid: false, error: `Invalid audit severity: ${event.severity}` };
    }
    if (!["schema", "format", "reference", "coverage"].includes(event.category)) {
      return { valid: false, error: `Invalid audit category: ${event.category}` };
    }
  }

  if (event.type === "drift") {
    if (typeof event.similarityScore !== "number" || event.similarityScore < 0 || event.similarityScore > 1) {
      return { valid: false, error: "similarityScore must be 0.0–1.0" };
    }
    if (!["semantic", "structural", "reference"].includes(event.driftType)) {
      return { valid: false, error: `Invalid drift type: ${event.driftType}` };
    }
  }

  if (event.type === "sync") {
    if (!["refresh", "promotion", "rollback"].includes(event.syncType)) {
      return { valid: false, error: `Invalid sync type: ${event.syncType}` };
    }
    if (!["initiated", "in_progress", "success", "failed"].includes(event.status)) {
      return { valid: false, error: `Invalid sync status: ${event.status}` };
    }
  }

  if (event.type === "consolidation") {
    if (!["semantic", "structural", "manual"].includes(event.mergeStrategy)) {
      return { valid: false, error: `Invalid merge strategy: ${event.mergeStrategy}` };
    }
    if (!["initiated", "in_progress", "success", "failed"].includes(event.status)) {
      return { valid: false, error: `Invalid consolidation status: ${event.status}` };
    }
  }

  return { valid: true };
}

// === Event Processing ===

export interface CICState {
  drift: Record<string, number>;
  audits: AuditEvent[];
  governance: Array<{
    type: string;
    docId?: string;
    timestamp: number;
    sequenceId: number;
  }>;
}

function processDriftEvent(event: DriftEvent, cicState: CICState): void {
  const backend = "docs-manager";

  // Increment drift penalty based on severity
  let penalty = 0;
  if (event.breached) {
    const drift = 1 - event.similarityScore;
    if (drift >= 0.2) penalty += 0.1;  // Any meaningful drift
    if (drift >= 0.4) penalty += 0.2;  // Moderate drift
    if (drift >= 0.6) penalty += 0.2;  // Severe drift
  }

  const current = cicState.drift[backend] ?? 0;
  cicState.drift[backend] = Math.min(1.0, current + penalty);
}

function processSyncEvent(event: SyncEvent, cicState: CICState): void {
  if (event.status === "success") {
    cicState.governance.push({
      type: `docs_manager_sync_${event.syncType}`,
      docId: event.docId,
      timestamp: event.timestamp,
      sequenceId: event.sequenceId,
    });
  }
}

function processConsolidationEvent(
  event: ConsolidationEvent,
  cicState: CICState
): void {
  if (event.status === "success") {
    cicState.governance.push({
      type: "docs_manager_consolidation",
      docId: event.targetDocId,
      timestamp: event.timestamp,
      sequenceId: event.sequenceId,
    });
  }
}

function processAuditEvent(event: AuditEvent, cicState: CICState): void {
  cicState.audits.push(event);
}

function processEvent(event: DocsManagerEvent, cicState: CICState): void {
  switch (event.type) {
    case "audit":
      processAuditEvent(event, cicState);
      break;
    case "drift":
      processDriftEvent(event, cicState);
      break;
    case "sync":
      processSyncEvent(event, cicState);
      break;
    case "consolidation":
      processConsolidationEvent(event, cicState);
      break;
  }
}

// === Main Job ===

export function runDocsManagerIngestionJob(cicState: CICState): void {
  if (!fs.existsSync(JSONL_PATH)) {
    return;
  }

  const state = loadState();
  let processed = 0;
  let skipped = 0;

  try {
    const content = fs.readFileSync(JSONL_PATH, "utf8");
    const lines = content.trim().split("\n");

    for (const line of lines) {
      if (!line.trim()) continue;

      // Parse JSON
      let event: any;
      try {
        event = JSON.parse(line);
      } catch (err) {
        skipped++;
        console.warn(`[DocsManager] Malformed JSONL line, skipping: ${line.slice(0, 80)}...`);
        continue;
      }

      // Validate
      const validation = validateEvent(event);
      if (!validation.valid) {
        skipped++;
        console.warn(
          `[DocsManager] Invalid event (sequenceId ${event.sequenceId}): ${validation.error}`
        );
        continue;
      }

      // Skip if already processed
      if (event.sequenceId <= state.lastSeenSequenceId) {
        skipped++;
        console.debug(`[DocsManager] Duplicate sequenceId ${event.sequenceId}, skipping`);
        continue;
      }

      // Process
      try {
        processEvent(event, cicState);
        state.lastSeenSequenceId = event.sequenceId;
        state.lastProcessedTimestamp = event.timestamp;
        processed++;
      } catch (err) {
        skipped++;
        console.error(
          `[DocsManager] Failed to process event (sequenceId ${event.sequenceId}): ${err}`
        );
      }
    }

    state.eventsProcessed += processed;
    state.eventsSkipped += skipped;
    saveState(state);

    if (processed > 0 || skipped > 0) {
      console.log(
        `[DocsManager] Job complete: ${processed} processed, ${skipped} skipped`
      );
    }
  } catch (err) {
    console.error(`[DocsManager] Ingestion job failed: ${err}`);
  }
}

// === Metrics Export ===

export interface DocsManagerMetrics {
  drift: number;
  audits: AuditEvent[];
  lastSync: number | null;
  eventsProcessed: number;
  eventsSkipped: number;
}

export function getDocsManagerMetrics(cicState: CICState): DocsManagerMetrics {
  const state = loadState();
  const drift = cicState.drift["docs-manager"] ?? 0;

  // Limit audits to last 50 for dashboard
  const audits = cicState.audits.slice(-50);

  return {
    drift,
    audits,
    lastSync: state.lastProcessedTimestamp || null,
    eventsProcessed: state.eventsProcessed,
    eventsSkipped: state.eventsSkipped,
  };
}
