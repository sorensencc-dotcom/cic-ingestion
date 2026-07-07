#!/usr/bin/env node

/**
 * DLQ Replayer CLI
 * Reads failed-jobs.log, re-runs extraction + verify per entry.
 * Recovers fixable entries, persists replay count, appends lessons on repeat failures.
 * Rotation: renames to failed-jobs.<date>.log when > 10MB or > 30 days old.
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { clientSessionExtractor } from "../extractors/clientSessionExtractor.js";
import { verifyIngestionEntry, VerifyReasonCode } from "./verify.js";

interface DlqEntry {
  dlqVersion: number;
  timestamp: string;
  entry: any;
  reasonCode?: string;
  reason?: string;
  replayCount: number;
}

const DLQ_DIR = path.join(process.cwd(), "cic-ingestion", "dlq");
const DLQ_PATH = path.join(DLQ_DIR, "failed-jobs.log");
const RECOVERED_PATH = path.join(DLQ_DIR, "dlq-recovered.log");
const EXTRACTOR_MD = path.join(process.cwd(), "cic-ingestion", "EXTRACTOR.md");

const MAX_DLQ_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_DLQ_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function rotateDlqIfNeeded(): void {
  if (!fs.existsSync(DLQ_PATH)) return;

  const stat = fs.statSync(DLQ_PATH);
  const age = Date.now() - stat.mtimeMs;

  if (stat.size > MAX_DLQ_SIZE_BYTES || age > MAX_DLQ_AGE_MS) {
    const date = formatDate(new Date(stat.mtimeMs));
    const rotated = path.join(DLQ_DIR, `failed-jobs.${date}.log`);
    fs.renameSync(DLQ_PATH, rotated);
    console.log(`[DLQ] Rotated to ${path.basename(rotated)}`);
  }
}

async function replayEntry(dlqEntry: DlqEntry): Promise<{ ok: boolean; reason?: string }> {
  try {
    const extracted = await clientSessionExtractor(dlqEntry.entry);
    const verifyResult = verifyIngestionEntry(extracted);

    if (verifyResult.ok) {
      return { ok: true };
    }

    return { ok: false, reason: verifyResult.reason };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function appendRecovered(dlqEntry: DlqEntry): void {
  try {
    fs.mkdirSync(path.dirname(RECOVERED_PATH), { recursive: true });
    fs.appendFileSync(
      RECOVERED_PATH,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        dlqEntry,
        recoveredAt: new Date().toISOString(),
      }) + "\n",
      "utf8"
    );
  } catch (err: any) {
    console.error("[DLQ] Failed to write recovered entry:", err.message);
  }
}

function appendLesson(reasonCode: VerifyReasonCode, pattern: string): void {
  try {
    fs.mkdirSync(path.dirname(EXTRACTOR_MD), { recursive: true });

    const heading = `## ${formatDate(new Date())} — ${reasonCode}: ${pattern}`;
    const entry = `${heading}\n**Fix:** [Operator to investigate and document fix]\n**Why:** DLQ replay reached replayCount >= 2\n\n`;

    if (fs.existsSync(EXTRACTOR_MD)) {
      const content = fs.readFileSync(EXTRACTOR_MD, "utf8");
      if (!content.includes(heading)) {
        fs.appendFileSync(EXTRACTOR_MD, entry, "utf8");
      }
    } else {
      fs.writeFileSync(EXTRACTOR_MD, entry, "utf8");
    }
  } catch (err: any) {
    console.error("[DLQ] Failed to append lesson:", err.message);
  }
}

async function main(): Promise<void> {
  try {
    console.log(`[DLQ] Replayer starting at ${new Date().toISOString()}`);

    rotateDlqIfNeeded();

    if (!fs.existsSync(DLQ_PATH)) {
      console.log("[DLQ] No failed-jobs.log found");
      return;
    }

    const fileStream = fs.createReadStream(DLQ_PATH);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    const remaining: DlqEntry[] = [];
    const recovered: string[] = [];
    const reasonCodeCounts: Map<string, number> = new Map();

    for await (const line of rl) {
      if (!line.trim()) continue;

      let dlqEntry: DlqEntry;
      try {
        dlqEntry = JSON.parse(line) as DlqEntry;
      } catch {
        console.warn("[DLQ] Skipping malformed line");
        continue;
      }

      const result = await replayEntry(dlqEntry);

      if (result.ok) {
        recovered.push(line);
        appendRecovered(dlqEntry);
        console.log(`[DLQ] Recovered entry ${dlqEntry.entry?.id || "unknown"}`);
      } else {
        dlqEntry.replayCount += 1;
        remaining.push(dlqEntry);

        const rc = dlqEntry.reasonCode || "UNKNOWN";
        const count = (reasonCodeCounts.get(rc) || 0) + 1;
        reasonCodeCounts.set(rc, count);

        // Append lesson on replayCount >= 2
        if (dlqEntry.replayCount >= 2) {
          appendLesson(rc as VerifyReasonCode, result.reason || "Unknown pattern");
          console.log(`[DLQ] Lesson appended for ${rc} (replay ${dlqEntry.replayCount})`);
        }
      }
    }

    // Rewrite DLQ with remaining failures (in-place, no data loss)
    if (remaining.length > 0) {
      const lines = remaining.map((e) => JSON.stringify(e)).join("\n") + "\n";
      fs.writeFileSync(DLQ_PATH, lines, "utf8");
    } else {
      fs.unlinkSync(DLQ_PATH);
    }

    console.log(`[DLQ] Summary: recovered ${recovered.length}, remaining ${remaining.length}`);
    for (const [rc, count] of reasonCodeCounts.entries()) {
      console.log(`  ${rc}: ${count} entries`);
    }
  } catch (err: any) {
    console.error("[DLQ] Fatal error:", err.message);
    process.exit(1);
  }
}

main();
