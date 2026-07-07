import * as fs from "fs";
import * as path from "path";
import { ManifestRecord } from "./types";
import { loadManifest } from "./ingestionManifest";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");
const TEMP_PATH = path.join(MANIFEST_DIR, "ingestionManifest.tmp");
const LOCK_TIMEOUT_MS = 5000;

// List all quarantined items (in quarantine lane or with quarantine flag)
export function listQuarantined(): ManifestRecord[] {
  const records = loadManifest();
  return records.filter(
    (r) => r.lane === "quarantine" || r.operatorFlags?.quarantine === true
  );
}

// Get single quarantined item by ID
export function getQuarantined(id: string): ManifestRecord | undefined {
  const records = loadManifest();
  return records.find(
    (r) =>
      r.id === id && (r.lane === "quarantine" || r.operatorFlags?.quarantine === true)
  );
}

// Approve a quarantined item (mark for reingest, clear quarantine)
export function approveQuarantine(id: string, targetLane: string = "fast"): void {
  const record = getQuarantined(id);
  if (!record) {
    throw new Error(`Quarantined record not found: ${id}`);
  }

  // Update flags
  record.operatorFlags.forceReingest = true;
  record.operatorFlags.quarantine = false;
  record.lane = targetLane as any;

  // Append updated record
  appendRecord(record);
}

// Reject a quarantined item (mark as skip)
export function rejectQuarantine(id: string, reason?: string): void {
  const record = getQuarantined(id);
  if (!record) {
    throw new Error(`Quarantined record not found: ${id}`);
  }

  // Update flags
  record.operatorFlags.skip = true;
  record.operatorFlags.quarantine = false;

  // Append updated record
  appendRecord(record);
}

// Internal: append a record to manifest (handles locking)
function appendRecord(record: ManifestRecord): void {
  const lockAcquired = acquireLock();
  if (!lockAcquired) {
    throw new Error(`Failed to acquire manifest lock after ${LOCK_TIMEOUT_MS}ms`);
  }

  try {
    const line = JSON.stringify(record) + "\n";
    fs.appendFileSync(MANIFEST_PATH, line, { encoding: "utf-8" });

    // fsync
    const fd = fs.openSync(MANIFEST_PATH, "a");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
  } finally {
    releaseLock();
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
        const waitTime = Math.min(100, Math.max(10, Math.random() * 50));
        const now = Date.now();
        while (Date.now() - now < waitTime) {
          // Busy wait
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
