import * as fs from "fs";
import * as path from "path";
import { ManifestRecord } from "./types";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const MANIFEST_BACKUP = path.join(MANIFEST_DIR, "ingestionManifest.backup.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");
const LOCK_TIMEOUT_MS = 5000;

interface RepairStats {
  totalLines: number;
  validLines: number;
  corruptedLines: string[];
  missingFields: { line: string; fields: string[] }[];
}

function acquireLock(): boolean {
  const start = Date.now();
  while (Date.now() - start < LOCK_TIMEOUT_MS) {
    try {
      fs.writeFileSync(LOCK_PATH, "", { flag: "wx" });
      return true;
    } catch {
      // File exists, wait and retry
    }
  }
  return false;
}

function releaseLock(): void {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch {
    // Lock may not exist
  }
}

function validateRecord(record: any): { valid: boolean; missingFields: string[] } {
  const requiredFields = [
    "id",
    "source",
    "profile",
    "lane",
    "extractorsRun",
    "verification",
    "operatorFlags",
    "timestamps",
    "routingVersion",
    "retryCount",
  ];

  const missing: string[] = [];
  for (const field of requiredFields) {
    if (!(field in record)) {
      missing.push(field);
    }
  }

  return { valid: missing.length === 0, missingFields: missing };
}

export function repairManifest(): RepairStats {
  // Acquire lock
  const lockAcquired = acquireLock();
  if (!lockAcquired) {
    throw new Error(
      `Failed to acquire manifest lock after ${LOCK_TIMEOUT_MS}ms`
    );
  }

  try {
    if (!fs.existsSync(MANIFEST_PATH)) {
      return {
        totalLines: 0,
        validLines: 0,
        corruptedLines: [],
        missingFields: [],
      };
    }

    // Read original manifest
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    const stats: RepairStats = {
      totalLines: lines.length,
      validLines: 0,
      corruptedLines: [],
      missingFields: [],
    };

    const validRecords: ManifestRecord[] = [];

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as any;
        const validation = validateRecord(record);

        if (validation.valid) {
          validRecords.push(record);
          stats.validLines++;
        } else {
          stats.corruptedLines.push(line.substring(0, 100));
          stats.missingFields.push({
            line: line.substring(0, 50),
            fields: validation.missingFields,
          });
        }
      } catch (err) {
        // JSON parse error
        stats.corruptedLines.push(line.substring(0, 100));
      }
    }

    // Backup original if corrupted lines found
    if (stats.corruptedLines.length > 0) {
      fs.copyFileSync(MANIFEST_PATH, MANIFEST_BACKUP);
    }

    // Rewrite manifest with valid records only
    const cleanContent = validRecords
      .map((r) => JSON.stringify(r))
      .join("\n");
    if (cleanContent) {
      fs.writeFileSync(MANIFEST_PATH, cleanContent + "\n", { flag: "w" });
    } else {
      fs.writeFileSync(MANIFEST_PATH, "", { flag: "w" });
    }

    // fsync
    const fd = fs.openSync(MANIFEST_PATH, "a");
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    return stats;
  } finally {
    releaseLock();
  }
}

export function getRepairStats(): RepairStats {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      totalLines: 0,
      validLines: 0,
      corruptedLines: [],
      missingFields: [],
    };
  }

  const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  const stats: RepairStats = {
    totalLines: lines.length,
    validLines: 0,
    corruptedLines: [],
    missingFields: [],
  };

  for (const line of lines) {
    try {
      const record = JSON.parse(line) as any;
      const validation = validateRecord(record);

      if (validation.valid) {
        stats.validLines++;
      } else {
        stats.corruptedLines.push(line.substring(0, 100));
        stats.missingFields.push({
          line: line.substring(0, 50),
          fields: validation.missingFields,
        });
      }
    } catch (err) {
      stats.corruptedLines.push(line.substring(0, 100));
    }
  }

  return stats;
}
