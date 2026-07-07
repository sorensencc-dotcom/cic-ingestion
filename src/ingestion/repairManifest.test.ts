import * as fs from "fs";
import * as path from "path";
import { repairManifest, getRepairStats } from "./repairManifest";
import { recordIngestion } from "./ingestionManifest";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const MANIFEST_BACKUP = path.join(MANIFEST_DIR, "ingestionManifest.backup.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");

describe("repairManifest", () => {
  beforeEach(() => {
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(MANIFEST_BACKUP)) {
      fs.unlinkSync(MANIFEST_BACKUP);
    }
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(MANIFEST_BACKUP)) {
      fs.unlinkSync(MANIFEST_BACKUP);
    }
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  });

  test("repairManifest returns empty stats when no manifest exists", () => {
    const stats = repairManifest();
    expect(stats.totalLines).toBe(0);
    expect(stats.validLines).toBe(0);
    expect(stats.corruptedLines).toHaveLength(0);
  });

  test("repairManifest preserves valid records", () => {
    recordIngestion(
      { id: "test-1", source: "api.test.com" },
      { profile: "api", lane: "fast", extractors: ["http"] },
      { passed: true, errors: [], cost: 10 },
      { extractorCost: 10, verificationCost: 0, totalCost: 10 }
    );

    const stats = repairManifest();
    expect(stats.totalLines).toBe(1);
    expect(stats.validLines).toBe(1);
    expect(stats.corruptedLines).toHaveLength(0);

    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });

  test("repairManifest removes corrupted JSON lines", () => {
    // Add valid record
    recordIngestion(
      { id: "valid-1", source: "test.com" },
      { profile: "api", lane: "fast", extractors: [] },
      { passed: true, errors: [], cost: 5 },
      { extractorCost: 5, verificationCost: 0, totalCost: 5 }
    );

    // Manually add corrupted line
    fs.appendFileSync(MANIFEST_PATH, "{ invalid json\n");

    const stats = repairManifest();
    expect(stats.totalLines).toBe(2);
    expect(stats.validLines).toBe(1);
    expect(stats.corruptedLines).toHaveLength(1);

    // Verify corrupted line removed
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });

  test("repairManifest removes records with missing required fields", () => {
    // Valid record
    recordIngestion(
      { id: "valid-2", source: "test.com" },
      { profile: "api", lane: "fast", extractors: [] },
      { passed: true, errors: [], cost: 5 },
      { extractorCost: 5, verificationCost: 0, totalCost: 5 }
    );

    // Manually add incomplete record (missing id field)
    const incomplete = {
      source: "test.com",
      profile: "api",
      lane: "fast",
      extractorsRun: [],
      verification: { passed: true, errors: [] },
      operatorFlags: {},
      timestamps: { ingested: new Date().toISOString() },
      routingVersion: "1.0.0",
      retryCount: 0,
    };
    fs.appendFileSync(MANIFEST_PATH, JSON.stringify(incomplete) + "\n");

    const stats = repairManifest();
    expect(stats.totalLines).toBe(2);
    expect(stats.validLines).toBe(1);
    expect(stats.corruptedLines).toHaveLength(1);
    expect(stats.missingFields).toHaveLength(1);
    expect(stats.missingFields[0].fields).toContain("id");

    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });

  test("repairManifest creates backup of corrupted manifest", () => {
    recordIngestion(
      { id: "test-3", source: "test.com" },
      { profile: "api", lane: "fast", extractors: [] },
      { passed: true, errors: [], cost: 5 },
      { extractorCost: 5, verificationCost: 0, totalCost: 5 }
    );

    fs.appendFileSync(MANIFEST_PATH, "corrupted line\n");

    expect(fs.existsSync(MANIFEST_BACKUP)).toBe(false);
    repairManifest();
    expect(fs.existsSync(MANIFEST_BACKUP)).toBe(true);

    const backup = fs.readFileSync(MANIFEST_BACKUP, "utf-8");
    expect(backup).toContain("corrupted line");
  });

  test("getRepairStats analyzes without modifying", () => {
    recordIngestion(
      { id: "test-4", source: "test.com" },
      { profile: "api", lane: "fast", extractors: [] },
      { passed: true, errors: [], cost: 5 },
      { extractorCost: 5, verificationCost: 0, totalCost: 5 }
    );

    fs.appendFileSync(MANIFEST_PATH, "bad\n");

    const stats = getRepairStats();
    expect(stats.totalLines).toBe(2);
    expect(stats.validLines).toBe(1);
    expect(stats.corruptedLines).toHaveLength(1);

    // Verify manifest not modified
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(2);
  });

  test("repairManifest handles multiple corrupted lines", () => {
    recordIngestion(
      { id: "test-5", source: "test.com" },
      { profile: "api", lane: "fast", extractors: [] },
      { passed: true, errors: [], cost: 5 },
      { extractorCost: 5, verificationCost: 0, totalCost: 5 }
    );

    fs.appendFileSync(MANIFEST_PATH, "bad 1\nbad 2\nbad 3\n");

    const stats = repairManifest();
    expect(stats.totalLines).toBe(4);
    expect(stats.validLines).toBe(1);
    expect(stats.corruptedLines).toHaveLength(3);

    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(1);
  });

  test("repairManifest handles completely empty manifest", () => {
    fs.writeFileSync(MANIFEST_PATH, "");

    const stats = repairManifest();
    expect(stats.totalLines).toBe(0);
    expect(stats.validLines).toBe(0);

    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    expect(content).toBe("");
  });
});
