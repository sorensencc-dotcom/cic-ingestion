import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  ManifestRecord,
  RoutedIngestionDecision,
  VerificationResult,
  Cost,
  FileLockedError,
} from "./types";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");
const TEMP_PATH = path.join(MANIFEST_DIR, "ingestionManifest.tmp");
const LOCK_TIMEOUT_MS = 5000;

export function recordIngestion(
  entry: any,
  decision: RoutedIngestionDecision,
  verification: VerificationResult,
  cost: Cost,
  routingVersion?: string
): void {
  // Acquire lock with timeout
  const lockAcquired = acquireLock();
  if (!lockAcquired) {
    throw new FileLockedError(
      `Failed to acquire manifest lock after ${LOCK_TIMEOUT_MS}ms`
    );
  }

  try {
    // Build manifest record
    const record: ManifestRecord = {
      id: entry.id || crypto.randomUUID(),
      source: entry.source || "unknown",
      mediaType: entry.mediaType || "unknown/unknown",
      profile: decision.profile,
      lane: decision.lane,
      extractorsRun: decision.extractors,
      verification: {
        passed: verification.passed,
        errors: verification.errors || [],
      },
      operatorFlags: entry.operatorFlags || {},
      timestamps: {
        ingested: new Date().toISOString(),
        verified: new Date().toISOString(),
      },
      routingVersion: routingVersion || "1.0.0",
      retryCount: entry.retryCount || 0,
      cost: {
        extractorCost: cost.extractorCost,
        verificationCost: cost.verificationCost,
        totalCost: cost.totalCost,
      },
    };

    // Write to temp file
    const line = JSON.stringify(record) + "\n";
    fs.writeFileSync(TEMP_PATH, line, { flag: "w" });

    // fsync temp
    const fd = fs.openSync(TEMP_PATH, "a");
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    // Append temp to manifest
    fs.appendFileSync(MANIFEST_PATH, line, { encoding: "utf-8" });

    // fsync manifest
    const manifestFd = fs.openSync(MANIFEST_PATH, "a");
    fs.fsyncSync(manifestFd);
    fs.closeSync(manifestFd);

    // Clean up temp
    fs.unlinkSync(TEMP_PATH);
  } finally {
    // Release lock
    releaseLock();
  }
}

export function loadManifest(): ManifestRecord[] {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return [];
  }

  const records: ManifestRecord[] = [];
  const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    try {
      const record = JSON.parse(line) as ManifestRecord;
      records.push(record);
    } catch (err) {
      // Skip malformed lines with warning
      console.warn(`Skipping malformed manifest line: ${line.substring(0, 100)}`);
    }
  }

  return records;
}

export function backfillFromProcessedLines(
  processedLines: any[]
): void {
  for (const line of processedLines) {
    const verification: VerificationResult = {
      passed: line.verified === true,
      errors: line.errors || [],
      cost: 0,
    };

    const backfillCost: Cost = {
      extractorCost: 0,
      verificationCost: 0,
      totalCost: 0,
    };

    // Use backfill without operator overrides, mark as legacy
    recordIngestion(
      line,
      { profile: "filesystem", lane: "fast", extractors: line.extractors || [] },
      verification,
      backfillCost,
      "legacy"
    );
  }
}

function acquireLock(): boolean {
  const startTime = Date.now();
  while (Date.now() - startTime < LOCK_TIMEOUT_MS) {
    try {
      fs.writeFileSync(LOCK_PATH, "", { flag: "wx" });
      return true;
    } catch (err: any) {
      if (err.code === "EEXIST") {
        // Lock exists, retry
        const waitTime = Math.min(100, Math.max(10, Math.random() * 50));
        const now = Date.now();
        while (Date.now() - now < waitTime) {
          // Busy wait (OK for short intervals)
        }
        continue;
      }
      throw err;
    }
  }
  return false;
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch (err) {
    console.warn("Failed to release manifest lock:", err);
  }
}
