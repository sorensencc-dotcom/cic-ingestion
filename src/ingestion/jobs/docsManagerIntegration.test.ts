// C:\dev\cic-ingestion\src\ingestion\jobs\docsManagerIntegration.test.ts

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { runDocsManagerIngestionJob, getDocsManagerMetrics } from "./docsManagerJob";

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

function createMockState(): any {
  return {
    drift: {},
    audits: [],
    governance: [],
    slaMetrics: { backlogCount: 0, avgLatencyMs: 0 },
  };
}

describe("DocsManager Integration", () => {
  beforeEach(() => {
    if (fs.existsSync(JSONL_PATH)) fs.unlinkSync(JSONL_PATH);
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  });

  afterEach(() => {
    if (fs.existsSync(JSONL_PATH)) fs.unlinkSync(JSONL_PATH);
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  });

  it("end-to-end: emits events, ingests, and exposes metrics", () => {
    const dir = path.dirname(JSONL_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write sample events
    const events = [
      {
        schemaVersion: "1.0.0",
        type: "audit",
        timestamp: Date.now(),
        sequenceId: 1,
        docId: "doc:api:v1",
        path: "specs/api.yaml",
        severity: "error",
        category: "schema",
        message: "Missing operationId in endpoint",
      },
      {
        schemaVersion: "1.0.0",
        type: "drift",
        timestamp: Date.now(),
        sequenceId: 2,
        docId: "doc:api:v1",
        specId: "spec:api:v1",
        path: "specs/api.yaml",
        driftType: "semantic",
        similarityScore: 0.75,
        threshold: 0.95,
        breached: true,
      },
    ];

    fs.appendFileSync(JSONL_PATH, events.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");

    // Ingest
    const state = createMockState();
    runDocsManagerIngestionJob(state);

    // Verify state updated
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].message).toBe("Missing operationId in endpoint");
    expect(state.drift["docs-manager"]).toBeGreaterThan(0);

    // Verify metrics
    const metrics = getDocsManagerMetrics(state);
    expect(metrics.audits).toHaveLength(1);
    expect(metrics.drift).toBeGreaterThan(0);
    expect(metrics.eventsProcessed).toBe(2);
  });

  it("resume from last offset: new events ingested on second run", () => {
    const dir = path.dirname(JSONL_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // First batch
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

    fs.appendFileSync(JSONL_PATH, JSON.stringify(event1) + "\n", "utf8");

    const state1 = createMockState();
    runDocsManagerIngestionJob(state1);

    expect(state1.audits).toHaveLength(1);

    // Second batch: add another event
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

    fs.appendFileSync(JSONL_PATH, JSON.stringify(event2) + "\n", "utf8");

    const state2 = createMockState();
    runDocsManagerIngestionJob(state2);

    // Should only see event2 (state resumed from event1)
    expect(state2.audits).toHaveLength(1);
    expect(state2.audits[0].message).toBe("msg2");
  });

  it("metrics returns recent audits (last 50) for dashboard", () => {
    const dir = path.dirname(JSONL_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write 100 audit events
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
        message: `audit ${i}`,
      };
      fs.appendFileSync(JSONL_PATH, JSON.stringify(event) + "\n", "utf8");
    }

    const state = createMockState();
    runDocsManagerIngestionJob(state);

    const metrics = getDocsManagerMetrics(state);
    expect(metrics.audits.length).toBeLessThanOrEqual(50);
    expect(metrics.eventsProcessed).toBe(100);
  });
});
