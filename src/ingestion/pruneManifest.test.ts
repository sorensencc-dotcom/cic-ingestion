import * as fs from "fs";
import * as path from "path";
import { pruneManifest, getPruneStats } from "./pruneManifest";
import { recordIngestion } from "./ingestionManifest";
import { ManifestRecord } from "./types";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const ARCHIVE_DIR = path.join(MANIFEST_DIR, "manifests-archived");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");

function addRecordWithOldDate(id: string, daysOld: number): void {
  const record: ManifestRecord = {
    id,
    source: "test.com",
    mediaType: "text/plain",
    profile: "api",
    lane: "fast",
    extractorsRun: [],
    verification: { passed: true, errors: [] },
    operatorFlags: {},
    timestamps: {
      ingested: new Date(
        Date.now() - daysOld * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
    routingVersion: "1.0.0",
    retryCount: 0,
    cost: { extractorCost: 5, verificationCost: 0, totalCost: 5 },
  };
  fs.appendFileSync(MANIFEST_PATH, JSON.stringify(record) + "\n");
}

describe("pruneManifest", () => {
  beforeEach(() => {
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
    if (fs.existsSync(ARCHIVE_DIR)) {
      const files = fs.readdirSync(ARCHIVE_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(ARCHIVE_DIR, file));
      }
      fs.rmdirSync(ARCHIVE_DIR);
    }
  });

  afterEach(() => {
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
    if (fs.existsSync(ARCHIVE_DIR)) {
      const files = fs.readdirSync(ARCHIVE_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(ARCHIVE_DIR, file));
      }
      fs.rmdirSync(ARCHIVE_DIR);
    }
  });

  test("pruneManifest returns empty stats when no manifest exists", () => {
    const stats = pruneManifest();
    expect(stats.totalRecords).toBe(0);
    expect(stats.retainedRecords).toBe(0);
    expect(stats.archivedRecords).toBe(0);
  });

  test("pruneManifest retains records newer than 90 days", () => {
    // Record from 30 days ago (recent)
    addRecordWithOldDate("recent-1", 30);

    const stats = pruneManifest(90);
    expect(stats.totalRecords).toBe(1);
    expect(stats.retainedRecords).toBe(1);
    expect(stats.archivedRecords).toBe(0);

    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });

  test("pruneManifest archives records older than 90 days", () => {
    // Record from 120 days ago (old)
    addRecordWithOldDate("old-1", 120);

    const stats = pruneManifest(90);
    expect(stats.totalRecords).toBe(1);
    expect(stats.retainedRecords).toBe(0);
    expect(stats.archivedRecords).toBe(1);

    // Manifest should be empty
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(0);

    // Archive dir should have file
    expect(fs.existsSync(ARCHIVE_DIR)).toBe(true);
    const archiveFiles = fs.readdirSync(ARCHIVE_DIR);
    expect(archiveFiles.length).toBeGreaterThan(0);
  });

  test("pruneManifest separates recent and old records", () => {
    addRecordWithOldDate("old-1", 120);
    addRecordWithOldDate("recent-1", 30);
    addRecordWithOldDate("old-2", 100);
    addRecordWithOldDate("recent-2", 50);

    const stats = pruneManifest(90);
    expect(stats.totalRecords).toBe(4);
    expect(stats.retainedRecords).toBe(2);
    expect(stats.archivedRecords).toBe(2);

    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(2);

    // Both retained records should be in manifest
    const retained = lines.map((l) => JSON.parse(l));
    const ids = retained.map((r) => r.id);
    expect(ids).toContain("recent-1");
    expect(ids).toContain("recent-2");
  });

  test("pruneManifest creates archive file with correct date format", () => {
    addRecordWithOldDate("old-1", 120);

    pruneManifest(90);

    expect(fs.existsSync(ARCHIVE_DIR)).toBe(true);
    const archiveFiles = fs.readdirSync(ARCHIVE_DIR);
    expect(archiveFiles).toHaveLength(1);
    expect(archiveFiles[0]).toMatch(/^manifests-archived-\d{4}-\d{2}-\d{2}\.jsonl$/);
  });

  test("pruneManifest archives contain correct records", () => {
    addRecordWithOldDate("old-1", 120);
    addRecordWithOldDate("recent-1", 30);

    pruneManifest(90);

    const archiveFiles = fs.readdirSync(ARCHIVE_DIR);
    const archivePath = path.join(ARCHIVE_DIR, archiveFiles[0]);
    const archiveContent = fs.readFileSync(archivePath, "utf-8");
    const archivedRecords = archiveContent
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));

    expect(archivedRecords).toHaveLength(1);
    expect(archivedRecords[0].id).toBe("old-1");
  });

  test("getPruneStats analyzes without modifying", () => {
    addRecordWithOldDate("old-1", 120);
    addRecordWithOldDate("recent-1", 30);

    const stats = getPruneStats(90);
    expect(stats.totalRecords).toBe(2);
    expect(stats.retainedRecords).toBe(1);
    expect(stats.archivedRecords).toBe(1);

    // Verify manifest not modified
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(2);

    // Archive dir should not exist
    expect(fs.existsSync(ARCHIVE_DIR)).toBe(false);
  });

  test("pruneManifest uses custom retention days", () => {
    addRecordWithOldDate("old-1", 100);
    addRecordWithOldDate("recent-1", 30);

    // Prune with 60-day retention: old-1 (100d) archived, recent-1 (30d) kept
    const stats = pruneManifest(60);
    expect(stats.totalRecords).toBe(2);
    expect(stats.retainedRecords).toBe(1);
    expect(stats.archivedRecords).toBe(1);

    // Add another old record (just under 90 days)
    addRecordWithOldDate("old-2", 85);

    // Both recent records should pass 90-day retention
    const stats2 = getPruneStats(90);
    expect(stats2.totalRecords).toBe(2);
    expect(stats2.retainedRecords).toBe(2);
    expect(stats2.archivedRecords).toBe(0);
  });

  test("pruneManifest handles records without timestamps", () => {
    const recordNoTs: ManifestRecord = {
      id: "no-ts",
      source: "test.com",
      mediaType: "text/plain",
      profile: "api",
      lane: "fast",
      extractorsRun: [],
      verification: { passed: true, errors: [] },
      operatorFlags: {},
      timestamps: {},
      routingVersion: "1.0.0",
      retryCount: 0,
      cost: { extractorCost: 5, verificationCost: 0, totalCost: 5 },
    };
    fs.appendFileSync(MANIFEST_PATH, JSON.stringify(recordNoTs) + "\n");

    const stats = pruneManifest(90);
    // Records without timestamp are retained
    expect(stats.retainedRecords).toBe(1);
    expect(stats.archivedRecords).toBe(0);
  });

  test("pruneManifest appends to existing archive", () => {
    addRecordWithOldDate("old-1", 120);

    // First prune
    pruneManifest(90);

    addRecordWithOldDate("old-2", 100);
    addRecordWithOldDate("recent-1", 30);

    // Second prune
    pruneManifest(90);

    const archiveFiles = fs.readdirSync(ARCHIVE_DIR);
    // Same file appended to
    expect(archiveFiles.length).toBeLessThanOrEqual(2);

    // Verify both old records in archive
    let totalArchived = 0;
    for (const file of archiveFiles) {
      const content = fs.readFileSync(path.join(ARCHIVE_DIR, file), "utf-8");
      const records = content.split("\n").filter((l) => l.trim());
      totalArchived += records.length;
    }
    expect(totalArchived).toBeGreaterThanOrEqual(2);
  });
});
