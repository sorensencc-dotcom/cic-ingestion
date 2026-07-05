// cic-ingestion/src/ingestion/daemon.ts
// semver: 0.1.0
// date: 2026-06-29

import fs from "fs";
import path from "path";
import readline from "readline";
import { CICStateStore, BackendId } from "src/server/cicStateStore.js";
import { clientSessionExtractor } from "../extractors/clientSessionExtractor.js";
import { processClientSession } from "../harness/replayHarness.js";
import { decayDriftScores } from "../drift/driftEngine.js";
// TODO: verify audit-policy path — currently missing from codebase
// import { verifyAuditChain } from "cic/governance/audit-policy.js";
import { runDocsManagerIngestionJob } from "./jobs/docsManagerJob.js";

export class IngestionDaemon {
  private intervalId: NodeJS.Timeout | null = null;
  private processedLines = new Set<string>();

  constructor(
    private logPath: string,
    private stateStore: CICStateStore,
    private intervalMs: number = 30000
  ) {}

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.runCycle(), this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private addViolationInline(state: any, category: string, description: string, severity: "SEV-1" | "SEV-2" | "SEV-3"): void {
    const idx = state.violations.findIndex((v: any) => v.category === category);
    const violation = { category, description, severity, ts: Date.now() };

    if (idx !== -1) {
      state.violations[idx] = violation;
    } else {
      state.violations.push(violation);
    }

    if (severity === "SEV-1") {
      if (category === "governance_chain_break") {
        state.governanceLockdown = true;
        state.promotionsFrozen = true;
        state.rollbacksFrozen = true;
        state.activePlaybooks.governanceLockdown = true;
      }
    } else if (severity === "SEV-2") {
      if (category === "routing_oscillation") {
        state.routingFrozen = true;
        state.activePlaybooks.routingStability = true;
      } else if (category === "ingestion_backlog") {
        state.activePlaybooks.ingestionRecovery = true;
      }
    } else if (severity === "SEV-3") {
      if (category === "latency_breach" || category === "drift_spike" || category === "token_breach") {
        state.activePlaybooks.driftSpike = true;
      }
    }
  }

  private clearViolationInline(state: any, category: string): void {
    state.violations = state.violations.filter((v: any) => v.category !== category);

    if (category === "governance_chain_break") {
      state.governanceLockdown = false;
      state.promotionsFrozen = false;
      state.rollbacksFrozen = false;
      state.activePlaybooks.governanceLockdown = false;
    } else if (category === "routing_oscillation") {
      state.routingFrozen = false;
      state.activePlaybooks.routingStability = false;
      delete state.frozenBackend;
    } else if (category === "ingestion_backlog") {
      state.activePlaybooks.ingestionRecovery = false;
    } else if (category === "latency_breach" || category === "drift_spike" || category === "token_breach") {
      state.activePlaybooks.driftSpike = false;
    }
  }

  async runCycle(): Promise<void> {
    try {
      const state = this.stateStore.load();

      // 1. Check hash-chain integrity (TODO: verifyAuditChain not available in codebase)
      // const chainCheck = verifyAuditChain();
      // if (!chainCheck.valid) {
      //   this.addViolationInline(
      //     state,
      //     "governance_chain_break",
      //     `Hash-chain integrity broken at event index ${chainCheck.breakAt}`,
      //     "SEV-1"
      //   );
      // } else {
      //   this.clearViolationInline(state, "governance_chain_break");
      // }

      // 2. Read client_sessions.jsonl line-by-line (streaming)
      if (!fs.existsSync(this.logPath)) {
        return;
      }

      const fileStream = fs.createReadStream(this.logPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const newEntries: any[] = [];
      let totalLines = 0;
      let processedInCycle = 0;

      for await (const line of rl) {
        totalLines++;
        if (!line.trim()) continue;

        let entry: any;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }

        if (!entry || !entry.backend || !entry.timestamp) continue;
        const key = `${entry.timestamp}-${entry.backend}`;

        // Idempotency check
        if (this.processedLines.has(key)) continue;

        newEntries.push(entry);
        this.processedLines.add(key);
        processedInCycle++;
      }

      // Apply 5% decay to all drift scores at the start of the cycle
      decayDriftScores(state.drift);

      // Process new sessions and update drift scores
      let cycleTotalLatency = 0;
      let cycleTurns = 0;
      let cycleTotalTokens = 0;

      for (const entry of newEntries) {
        const extracted = await clientSessionExtractor(entry);
        processClientSession(extracted, state);

        if (entry.response?.meta?.latency_ms) {
          cycleTotalLatency += entry.response.meta.latency_ms;
          cycleTurns++;
        }
        if (entry.response?.usage?.total_tokens) {
          cycleTotalTokens += entry.response.usage.total_tokens;
        }
      }

      // Ingest docs-manager events (independent stream)
      runDocsManagerIngestionJob(state as any);

      // Update SLA Metrics
      const backlog = totalLines - this.processedLines.size;
      state.slaMetrics.backlogCount = backlog;
      state.slaMetrics.lastEvaluated = Date.now();
      state.slaMetrics.totalTokens += cycleTotalTokens;

      if (cycleTurns > 0) {
        state.slaMetrics.avgLatencyMs = cycleTotalLatency / cycleTurns;
      }

      // Backlog SLA check
      if (backlog > state.slaSettings.maxBacklog) {
        this.addViolationInline(
          state,
          "ingestion_backlog",
          `Ingestion backlog of ${backlog} entries exceeds threshold of ${state.slaSettings.maxBacklog}`,
          "SEV-2"
        );
      } else {
        this.clearViolationInline(state, "ingestion_backlog");
      }

      // Routing oscillation check
      const recentFails = newEntries.filter(
        e => (e.response?.meta?.latency_ms || 0) > state.slaSettings.maxLatencyMs || 
             (e.response?.usage?.total_tokens || 0) > state.slaSettings.maxTokens
      );

      if (recentFails.length > state.slaSettings.maxOscillations) {
        const lowestDriftBackend = (Object.entries(state.drift) as [BackendId, number][])
          .sort(([, a], [, b]) => a - b)[0]?.[0] ?? "mock";

        this.addViolationInline(
          state,
          "routing_oscillation",
          `Routing instability detected with ${recentFails.length} SLA violations in recent turn set. Freezing routing.`,
          "SEV-2"
        );
        state.routingFrozen = true;
        state.frozenBackend = lowestDriftBackend;
      } else {
        this.clearViolationInline(state, "routing_oscillation");
      }

      this.stateStore.save(state);
    } catch (err: any) {
      console.error("[IngestionDaemon] cycle error:", err.message);
    }
  }
}
