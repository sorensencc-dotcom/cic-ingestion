#!/usr/bin/env node
/**
 * ingestion-durability-gate.ts
 * Phase 27 Wave E: Verify repair & prune operations work
 */

import * as fs from "fs";
import * as path from "path";
import { recordIngestion } from "./ingestionManifest";
import { repairManifest, getRepairStats } from "./repairManifest";
import { pruneManifest, getPruneStats } from "./pruneManifest";
import { ManifestRecord } from "./types";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");
const ARCHIVE_DIR = path.join(MANIFEST_DIR, "manifests-archived");

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ ${message}`);
    failCount++;
  }
}

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

function setup(): void {
  // Clean up manifest
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
}

function testRepairDetectsCorruption(): void {
  console.log("\n[Gate] Testing repair: detect corruption");
  setup();

  recordIngestion(
    { id: "valid-1", source: "test.com" },
    { profile: "api", lane: "fast", extractors: [] },
    { passed: true, errors: [], cost: 5 },
    { extractorCost: 5, verificationCost: 0, totalCost: 5 }
  );

  // Add corrupted line
  fs.appendFileSync(MANIFEST_PATH, "{ invalid json\n");

  const stats = getRepairStats();
  assert(stats.totalLines === 2, "Detected 2 lines (1 valid + 1 corrupted)");
  assert(stats.validLines === 1, "Identified 1 valid line");
  assert(stats.corruptedLines.length === 1, "Identified 1 corrupted line");
}

function testRepairRemovesCorruption(): void {
  console.log("\n[Gate] Testing repair: remove corruption");
  setup();

  recordIngestion(
    { id: "valid-2", source: "test.com" },
    { profile: "api", lane: "fast", extractors: [] },
    { passed: true, errors: [], cost: 5 },
    { extractorCost: 5, verificationCost: 0, totalCost: 5 }
  );

  fs.appendFileSync(MANIFEST_PATH, "corrupted\n");
  fs.appendFileSync(MANIFEST_PATH, "more corruption\n");

  const stats = repairManifest();
  assert(stats.totalLines === 3, "Analyzed 3 lines");
  assert(stats.validLines === 1, "Retained 1 valid line");
  assert(stats.corruptedLines.length === 2, "Removed 2 corrupted lines");

  const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  assert(lines.length === 1, "Manifest cleaned: 1 line remaining");
}

function testPruneDetectsOldRecords(): void {
  console.log("\n[Gate] Testing prune: detect old records");
  setup();

  addRecordWithOldDate("old-1", 120);
  addRecordWithOldDate("recent-1", 30);
  addRecordWithOldDate("old-2", 100);

  const stats = getPruneStats(90);
  assert(stats.totalRecords === 3, "Analyzed 3 records");
  assert(stats.retainedRecords === 1, "Found 1 recent record");
  assert(stats.archivedRecords === 2, "Found 2 old records");
}

function testPruneArchivesOldRecords(): void {
  console.log("\n[Gate] Testing prune: archive old records");
  setup();

  addRecordWithOldDate("old-1", 120);
  addRecordWithOldDate("recent-1", 30);
  addRecordWithOldDate("old-2", 100);

  const stats = pruneManifest(90);
  assert(stats.totalRecords === 3, "Processed 3 records");
  assert(stats.retainedRecords === 1, "Retained 1 recent record");
  assert(stats.archivedRecords === 2, "Archived 2 old records");

  // Verify manifest has only recent
  const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  assert(lines.length === 1, "Manifest contains 1 recent record");

  // Verify archive exists
  assert(fs.existsSync(ARCHIVE_DIR), "Archive directory created");
  const archiveFiles = fs.readdirSync(ARCHIVE_DIR);
  assert(archiveFiles.length > 0, "Archive file created");

  // Verify archive content
  const archivePath = path.join(ARCHIVE_DIR, archiveFiles[0]);
  const archiveContent = fs.readFileSync(archivePath, "utf-8");
  const archived = archiveContent.split("\n").filter((l) => l.trim());
  assert(archived.length === 2, "Archive contains 2 old records");
}

function testCombinedRepairAndPrune(): void {
  console.log("\n[Gate] Testing combined: repair + prune");
  setup();

  recordIngestion(
    { id: "valid-1", source: "test.com" },
    { profile: "api", lane: "fast", extractors: [] },
    { passed: true, errors: [], cost: 5 },
    { extractorCost: 5, verificationCost: 0, totalCost: 5 }
  );

  addRecordWithOldDate("old-1", 120);

  // Corrupt it
  fs.appendFileSync(MANIFEST_PATH, "bad data\n");

  // Repair first
  const repairStats = repairManifest();
  assert(repairStats.validLines === 2, "Repair: 2 valid records retained");

  // Then prune
  const pruneStats = pruneManifest(90);
  assert(pruneStats.retainedRecords === 1, "Prune: 1 recent record retained");
  assert(pruneStats.archivedRecords === 1, "Prune: 1 old record archived");

  const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  assert(lines.length === 1, "Final manifest has 1 record");
}

function testPruneDateFormats(): void {
  console.log("\n[Gate] Testing prune: archive filename format");
  setup();

  addRecordWithOldDate("old-1", 120);

  pruneManifest(90);

  const archiveFiles = fs.readdirSync(ARCHIVE_DIR);
  const filename = archiveFiles[0];

  assert(
    /manifests-archived-\d{4}-\d{2}-\d{2}\.jsonl/.test(filename),
    `Archive filename has date format: ${filename}`
  );
}

function cleanup(): void {
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
}

// ============================================================================
// RUN GATE
// ============================================================================

console.log("=========================================");
console.log("ingestion-durability-gate");
console.log("Phase 27 Wave E: Repair & Prune validation");
console.log("=========================================");

try {
  testRepairDetectsCorruption();
  testRepairRemovesCorruption();
  testPruneDetectsOldRecords();
  testPruneArchivesOldRecords();
  testCombinedRepairAndPrune();
  testPruneDateFormats();

  cleanup();

  console.log("\n=========================================");
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log("=========================================");

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log("✓ All gates passed");
    process.exit(0);
  }
} catch (e) {
  console.error("Gate execution failed:", e);
  cleanup();
  process.exit(1);
}
