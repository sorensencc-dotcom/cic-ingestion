import * as fs from "fs";
import * as path from "path";
import { ManifestRecord } from "./types";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const ARCHIVE_DIR = path.join(MANIFEST_DIR, "manifests-archived");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");
const LOCK_TIMEOUT_MS = 5000;
const RETENTION_DAYS = 90;

interface PruneStats {
  totalRecords: number;
  retainedRecords: number;
  archivedRecords: number;
  oldestRetainedDate?: string;
  youngestArchivedDate?: string;
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

function getTimestampDate(record: ManifestRecord): Date | null {
  const timestamp =
    record.timestamps?.ingested ||
    record.timestamps?.verified ||
    record.timestamps?.indexed;
  if (!timestamp) return null;
  try {
    return new Date(timestamp);
  } catch {
    return null;
  }
}

function getDaysOld(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function pruneManifest(retentionDays: number = RETENTION_DAYS): PruneStats {
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
        totalRecords: 0,
        retainedRecords: 0,
        archivedRecords: 0,
      };
    }

    // Create archive directory if needed
    if (!fs.existsSync(ARCHIVE_DIR)) {
      fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    }

    // Read manifest
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    const stats: PruneStats = {
      totalRecords: lines.length,
      retainedRecords: 0,
      archivedRecords: 0,
    };

    const retainedRecords: ManifestRecord[] = [];
    const archivedRecords: ManifestRecord[] = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as ManifestRecord;
        const recordDate = getTimestampDate(record);

        if (!recordDate || recordDate >= cutoffDate) {
          retainedRecords.push(record);
          stats.retainedRecords++;
          if (!stats.oldestRetainedDate || recordDate) {
            if (!stats.oldestRetainedDate) {
              stats.oldestRetainedDate = recordDate?.toISOString();
            }
          }
        } else {
          archivedRecords.push(record);
          stats.archivedRecords++;
          if (!stats.youngestArchivedDate) {
            stats.youngestArchivedDate = recordDate.toISOString();
          }
        }
      } catch (err) {
        // Skip malformed lines
        continue;
      }
    }

    // Write archived records to archive file
    if (archivedRecords.length > 0) {
      const archiveFilename = `manifests-archived-${new Date().toISOString().split("T")[0]}.jsonl`;
      const archivePath = path.join(ARCHIVE_DIR, archiveFilename);
      const archiveContent = archivedRecords
        .map((r) => JSON.stringify(r))
        .join("\n");
      fs.writeFileSync(archivePath, archiveContent + "\n", { flag: "a" });

      // fsync archive
      const archiveFd = fs.openSync(archivePath, "a");
      fs.fsyncSync(archiveFd);
      fs.closeSync(archiveFd);
    }

    // Rewrite manifest with retained records only
    const retainedContent = retainedRecords
      .map((r) => JSON.stringify(r))
      .join("\n");
    if (retainedContent) {
      fs.writeFileSync(MANIFEST_PATH, retainedContent + "\n", { flag: "w" });
    } else {
      fs.writeFileSync(MANIFEST_PATH, "", { flag: "w" });
    }

    // fsync manifest
    const fd = fs.openSync(MANIFEST_PATH, "a");
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    return stats;
  } finally {
    releaseLock();
  }
}

export function getPruneStats(retentionDays: number = RETENTION_DAYS): PruneStats {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      totalRecords: 0,
      retainedRecords: 0,
      archivedRecords: 0,
    };
  }

  const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  const stats: PruneStats = {
    totalRecords: lines.length,
    retainedRecords: 0,
    archivedRecords: 0,
  };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  for (const line of lines) {
    try {
      const record = JSON.parse(line) as ManifestRecord;
      const recordDate = getTimestampDate(record);

      if (!recordDate || recordDate >= cutoffDate) {
        stats.retainedRecords++;
        if (!stats.oldestRetainedDate) {
          stats.oldestRetainedDate = recordDate?.toISOString();
        }
      } else {
        stats.archivedRecords++;
        if (!stats.youngestArchivedDate) {
          stats.youngestArchivedDate = recordDate.toISOString();
        }
      }
    } catch (err) {
      // Skip malformed lines
      continue;
    }
  }

  return stats;
}
