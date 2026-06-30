// C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerJob.test.ts

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "fs";
import path from "path";
import {
  runDocsManagerIngestionJob,
  getDocsManagerMetrics,
  CICState,
} from "./docsManagerJob";

const JSONL_PATH = path.join(
  process.cwd(),
  "cic-ingestion",
  "logs",
  "docs_manager.jsonl"
);

const STATE_FILE = path.join(
  process.cwd(),
  "cic-ingestion",
  "state",
  "docs_manager_state.json"
);

function createTestState(): CICState {
  return {
    drift: {},
    audits: [],
    governance: [],
  };
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJsonlLine(event: any): void {
  ensureDir(path.dirname(JSONL_PATH));
  fs.appendFileSync(JSONL_PATH, JSON.stringify(event) + "\n", "utf8");
}

describe("DocsManager Ingestion Job", () => {
  beforeEach(() => {
    // Cleanup
    if (fs.existsSync(JSONL_PATH)) fs.unlinkSync(JSONL_PATH);
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(JSONL_PATH)) fs.unlinkSync(JSONL_PATH);
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  });

  describe("Basic ingestion", () => {
    it("processes valid audit event", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api:v1",
        path: "specs/api.yaml",
        severity: "error",
        category: "schema",
        message: "Missing operationId",
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      expect(cicState.audits).toHaveLength(1);
      expect(cicState.audits[0].message).toBe("Missing operationId");
    });

    it("processes valid drift event and updates drift score", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "drift",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api:v1",
        specId: "spec:api:v1",
        path: "specs/api.yaml",
        driftType: "semantic",
        similarityScore: 0.75,
        threshold: 0.95,
        breached: true,
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      expect(cicState.drift["docs-manager"]).toBeGreaterThan(0);
    });

    it("processes valid sync event and adds governance entry on success", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "sync",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api:v1",
        syncType: "promotion",
        fromVersion: "staging",
        toVersion: "v1.3.0",
        path: "specs/api.yaml",
        status: "success",
        duration: 2500,
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      expect(cicState.governance).toHaveLength(1);
      expect(cicState.governance[0].type).toBe("docs_manager_sync_promotion");
    });

    it("ignores sync event with failed status", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "sync",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api:v1",
        syncType: "promotion",
        fromVersion: "staging",
        toVersion: "v1.3.0",
        path: "specs/api.yaml",
        status: "failed",
        errorMessage: "Schema validation failed",
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      expect(cicState.governance).toHaveLength(0);
    });

    it("processes consolidation event on success", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "consolidation",
        timestamp: Date.now(),
        sequenceId: 1,
        consolidationId: "cons:api:20260630",
        sourceDocIds: ["doc:v1", "doc:v2"],
        targetDocId: "doc:canonical",
        status: "success",
        mergeStrategy: "semantic",
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      expect(cicState.governance).toHaveLength(1);
      expect(cicState.governance[0].type).toBe("docs_manager_consolidation");
    });
  });

  describe("State tracking", () => {
    it("saves state after processing events", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        path: "path",
        severity: "error",
        category: "schema",
        message: "msg",
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      expect(fs.existsSync(STATE_FILE)).toBe(true);
      const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      expect(state.lastSeenSequenceId).toBe(1);
      expect(state.eventsProcessed).toBe(1);
    });

    it("resumes from last offset on subsequent runs", () => {
      const event1 = {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        path: "path",
        severity: "error",
        category: "schema",
        message: "msg1",
      };

      writeJsonlLine(event1);

      const cicState1 = createTestState();
      runDocsManagerIngestionJob(cicState1);

      expect(cicState1.audits).toHaveLength(1);

      // Add a second event
      const event2 = {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 2,
        docId: "doc:api",
        path: "path",
        severity: "warning",
        category: "format",
        message: "msg2",
      };

      writeJsonlLine(event2);

      const cicState2 = createTestState();
      runDocsManagerIngestionJob(cicState2);

      // Should only process event2
      expect(cicState2.audits).toHaveLength(1);
      expect(cicState2.audits[0].message).toBe("msg2");
    });
  });

  describe("Error handling", () => {
    it("skips malformed JSON line", () => {
      ensureDir(path.dirname(JSONL_PATH));
      fs.writeFileSync(JSONL_PATH, "{ invalid json\n", "utf8");

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      expect(state.eventsSkipped).toBe(1);
      expect(cicState.audits).toHaveLength(0);
    });

    it("skips event with invalid schemaVersion", () => {
      const event = {
        schemaVersion: "2.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        path: "path",
        severity: "error",
        category: "schema",
        message: "msg",
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      expect(state.eventsSkipped).toBe(1);
    });

    it("skips event with invalid event type", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "invalid",
        timestamp: Date.now(),
        sequenceId: 1,
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      expect(state.eventsSkipped).toBe(1);
    });

    it("skips event with invalid timestamp (outside ±1 day)", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now() + 100 * 24 * 60 * 60 * 1000, // 100 days in future
        sequenceId: 1,
        docId: "doc:api",
        path: "path",
        severity: "error",
        category: "schema",
        message: "msg",
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      expect(state.eventsSkipped).toBe(1);
    });

    it("skips duplicate sequenceId", () => {
      const event1 = {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        path: "path",
        severity: "error",
        category: "schema",
        message: "msg1",
      };

      writeJsonlLine(event1);

      const cicState1 = createTestState();
      runDocsManagerIngestionJob(cicState1);

      // Duplicate sequenceId
      const event2 = {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        path: "path",
        severity: "warning",
        category: "format",
        message: "msg2",
      };

      writeJsonlLine(event2);

      const cicState2 = createTestState();
      runDocsManagerIngestionJob(cicState2);

      const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      expect(state.eventsSkipped).toBeGreaterThan(0);
    });
  });

  describe("Drift calculation", () => {
    it("applies penalty for breached drift with low similarity", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "drift",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        specId: "spec:api",
        path: "path",
        driftType: "semantic",
        similarityScore: 0.6, // 1 - 0.6 = 0.4 drift, >= 0.2 and >= 0.4
        threshold: 0.95,
        breached: true,
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const driftScore = cicState.drift["docs-manager"] ?? 0;
      expect(driftScore).toBeCloseTo(0.3, 5); // 0.4 drift: +0.1 (>=0.2) + 0.2 (>=0.4) = 0.3
    });

    it("applies higher penalty for severe drift", () => {
      const event = {
        schemaVersion: "1.0.0",
        type: "drift",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        specId: "spec:api",
        path: "path",
        driftType: "semantic",
        similarityScore: 0.4, // 1 - 0.4 = 0.6 drift, >= 0.2, >= 0.4, >= 0.6
        threshold: 0.95,
        breached: true,
      };

      writeJsonlLine(event);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const driftScore = cicState.drift["docs-manager"] ?? 0;
      expect(driftScore).toBeCloseTo(0.5, 5); // 0.6 drift: +0.1 (>=0.2) + 0.2 (>=0.4) + 0.2 (>=0.6) = 0.5
    });

    it("accumulates drift across multiple events", () => {
      const event1 = {
        schemaVersion: "1.0.0",
        type: "drift",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        specId: "spec:api",
        path: "path",
        driftType: "semantic",
        similarityScore: 0.6,
        threshold: 0.95,
        breached: true,
      };

      const event2 = {
        schemaVersion: "1.0.0",
        type: "drift",
        timestamp: Date.now(),
        sequenceId: 2,
        docId: "doc:api",
        specId: "spec:api",
        path: "path",
        driftType: "semantic",
        similarityScore: 0.4,
        threshold: 0.95,
        breached: true,
      };

      writeJsonlLine(event1);
      writeJsonlLine(event2);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const driftScore = cicState.drift["docs-manager"] ?? 0;
      expect(driftScore).toBeCloseTo(0.8, 5); // 0.3 (drift 0.4) + 0.5 (drift 0.6)
    });

    it("caps drift at 1.0", () => {
      for (let i = 1; i <= 20; i++) {
        const event = {
          schemaVersion: "1.0.0",
          type: "drift",
          timestamp: Date.now(),
          sequenceId: i,
          docId: "doc:api",
          specId: "spec:api",
          path: "path",
          driftType: "semantic",
          similarityScore: 0.4,
          threshold: 0.95,
          breached: true,
        };
        writeJsonlLine(event);
      }

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const driftScore = cicState.drift["docs-manager"] ?? 0;
      expect(driftScore).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Metrics export", () => {
    it("returns metrics with drift and audit count", () => {
      const event1 = {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api",
        path: "path",
        severity: "error",
        category: "schema",
        message: "msg1",
      };

      const event2 = {
        schemaVersion: "1.0.0",
        type: "drift",
        timestamp: Date.now(),
        sequenceId: 2,
        docId: "doc:api",
        specId: "spec:api",
        path: "path",
        driftType: "semantic",
        similarityScore: 0.6,
        threshold: 0.95,
        breached: true,
      };

      writeJsonlLine(event1);
      writeJsonlLine(event2);

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const metrics = getDocsManagerMetrics(cicState);

      expect(metrics.drift).toBeGreaterThan(0);
      expect(metrics.audits).toHaveLength(1);
      expect(metrics.lastSync).toBeGreaterThan(0);
      expect(metrics.eventsProcessed).toBe(2);
      expect(metrics.eventsSkipped).toBe(0);
    });

    it("limits audits to last 50 in metrics", () => {
      for (let i = 1; i <= 100; i++) {
        const event = {
          schemaVersion: "1.0.0",
          type: "audit",
          timestamp: Date.now(),
          sequenceId: i,
          docId: `doc:api:${i}`,
          path: "path",
          severity: "error",
          category: "schema",
          message: `msg${i}`,
        };
        writeJsonlLine(event);
      }

      const cicState = createTestState();
      runDocsManagerIngestionJob(cicState);

      const metrics = getDocsManagerMetrics(cicState);
      expect(metrics.audits).toHaveLength(50);
      expect(metrics.audits[0].message).toBe("msg51"); // Last 50 starting from index 51
    });
  });

  describe("Empty JSONL file", () => {
    it("handles missing JSONL file gracefully", () => {
      const cicState = createTestState();
      expect(() => {
        runDocsManagerIngestionJob(cicState);
      }).not.toThrow();

      expect(cicState.audits).toHaveLength(0);
    });

    it("handles empty JSONL file", () => {
      ensureDir(path.dirname(JSONL_PATH));
      fs.writeFileSync(JSONL_PATH, "", "utf8");

      const cicState = createTestState();
      expect(() => {
        runDocsManagerIngestionJob(cicState);
      }).not.toThrow();

      expect(cicState.audits).toHaveLength(0);
    });
  });
});
