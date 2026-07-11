// cic-ingestion/src/ingestion/daemon-routing.ts
// Phase 27 daemon with routing integration
// This is a temporary wrapper to showcase routing integration
// Will be merged into daemon.ts after Wave C validation

import fs from "fs";
import path from "path";
import readline from "readline";
import { CICStateStore, BackendId } from "src/server/cicStateStore.ts";
import { clientSessionExtractor } from "../extractors/clientSessionExtractor.ts";
import { processClientSession } from "../harness/replayHarness.ts";
import { decayDriftScores } from "../drift/driftEngine.ts";
import { verifyIngestionEntry, VerifyResult } from "./verify.ts";
import { route } from "./ingestionRouter.ts";
import { recordIngestion } from "./ingestionManifest.ts";
import { getOverrideForEntry, applyOverride } from "./operatorOverrides.ts";
import { Cost, VerificationResult } from "./types.ts";

const ROUTING_ENABLED = process.env.CIC_INGESTION_ROUTING_ENABLED !== "false";

export class IngestionDaemonRouting {
  private intervalId: NodeJS.Timeout | null = null;
  private processedLines = new Set<string>();
  private dlqPath: string;
  private quarantinedIds = new Set<string>();

  constructor(
    private logPath: string,
    private stateStore: CICStateStore,
    private intervalMs: number = 30000
  ) {
    this.dlqPath = path.join(path.dirname(logPath), "..", "dlq", "failed-jobs.log");
  }

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

  private addViolationInline(
    state: any,
    category: string,
    description: string,
    severity: "SEV-1" | "SEV-2" | "SEV-3"
  ): void {
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
      if (
        category === "latency_breach" ||
        category === "drift_spike" ||
        category === "token_breach"
      ) {
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
    } else if (
      category === "latency_breach" ||
      category === "drift_spike" ||
      category === "token_breach"
    ) {
      state.activePlaybooks.driftSpike = false;
    }
  }

  private writeDlqEntry(entry: any, verifyResult: VerifyResult): void {
    try {
      const dlqEntry = {
        dlqVersion: 1,
        timestamp: new Date().toISOString(),
        entry,
        reasonCode: verifyResult.reasonCode,
        reason: verifyResult.reason,
        replayCount: 0,
      };

      fs.mkdirSync(path.dirname(this.dlqPath), { recursive: true });
      fs.appendFileSync(this.dlqPath, JSON.stringify(dlqEntry) + "\n", "utf8");
    } catch (err: any) {
      console.error("[IngestionDaemonRouting] DLQ write failed:", err.message);
    }
  }

  async runCycle(): Promise<void> {
    try {
      const state = this.stateStore.load();

      if (!fs.existsSync(this.logPath)) {
        return;
      }

      const fileStream = fs.createReadStream(this.logPath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
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

        if (this.processedLines.has(key)) continue;

        newEntries.push(entry);
        this.processedLines.add(key);
        processedInCycle++;
      }

      decayDriftScores(state.drift);

      let cycleTotalLatency = 0;
      let cycleTurns = 0;
      let cycleTotalTokens = 0;

      for (const entry of newEntries) {
        try {
          // Phase 27: Check operator overrides
          const override = getOverrideForEntry(entry);
          if (override?.skip) {
            console.log(`[IngestionDaemonRouting] Skipping entry ${entry.id} (operator override)`);
            continue;
          }

          let routingDecision: any = null;
          let operatorFlags = {};
          let extractorCost = 0.001; // Placeholder cost
          let verificationCost = 0.001; // Placeholder cost

          // Phase 27: Route if enabled
          if (ROUTING_ENABLED) {
            routingDecision = route(entry);

            // Apply operator overrides to routing decision
            if (override) {
              const applied = applyOverride(entry, override);
              operatorFlags = applied.operatorFlags;
              if (applied.profile) {
                routingDecision.profile = applied.profile;
              }
              if (applied.lane) {
                routingDecision.lane = applied.lane;
              }
            }
          } else {
            // Legacy mode: default routing
            routingDecision = {
              profile: "filesystem",
              lane: "fast",
              extractors: ["clientSessionExtractor"],
            };
          }

          // Extract (Phase 26 logic still used for now)
          const extracted = await clientSessionExtractor(entry);
          const verifyResult = verifyIngestionEntry(extracted);

          // Record to manifest (Phase 27)
          if (ROUTING_ENABLED) {
            const cost: Cost = {
              extractorCost,
              verificationCost,
              totalCost: extractorCost + verificationCost,
            };

            const verification: VerificationResult = {
              passed: verifyResult.ok,
              errors: verifyResult.ok ? [] : [verifyResult.reason || "unknown"],
              cost: verificationCost,
            };

            try {
              recordIngestion(
                { ...entry, operatorFlags },
                routingDecision,
                verification,
                cost
              );
            } catch (err: any) {
              console.error("[IngestionDaemonRouting] Manifest write failed:", err.message);
            }
          }

          // Handle quarantine path (Phase 27)
          if (ROUTING_ENABLED && !verifyResult.ok && routingDecision.lane === "deep") {
            console.log(
              `[IngestionDaemonRouting] Quarantining entry ${entry.id} (deep lane + failed verification)`
            );
            this.quarantinedIds.add(entry.id);
            continue; // Skip state mutation, don't index
          }

          // Handle DLQ path
          if (!verifyResult.ok) {
            this.writeDlqEntry(extracted, verifyResult);
            continue;
          }

          // Process if verification passed
          processClientSession(extracted, state);

          if (entry.response?.meta?.latency_ms) {
            cycleTotalLatency += entry.response.meta.latency_ms;
            cycleTurns++;
          }
          if (entry.response?.usage?.total_tokens) {
            cycleTotalTokens += entry.response.usage.total_tokens;
          }
        } catch (err: any) {
          console.error("[IngestionDaemonRouting] per-entry error:", err.message);
          this.writeDlqEntry(entry, {
            ok: false,
            reasonCode: "EXTRACTOR_ERROR",
            reason: err.message,
          });
        }
      }

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
        (e) =>
          (e.response?.meta?.latency_ms || 0) > state.slaSettings.maxLatencyMs ||
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
      console.error("[IngestionDaemonRouting] cycle error:", err.message);
    }
  }
}
