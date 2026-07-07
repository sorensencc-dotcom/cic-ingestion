import * as fs from "fs";
import * as path from "path";
import {
  listQuarantined,
  getQuarantined,
  approveQuarantine,
  rejectQuarantine,
} from "./quarantineReview";
import { recordIngestion } from "./ingestionManifest";
import { ManifestRecord } from "./types";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");

describe("quarantineReview", () => {
  beforeEach(() => {
    // Clean manifest
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(MANIFEST_PATH)) {
      fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(LOCK_PATH)) {
      fs.unlinkSync(LOCK_PATH);
    }
  });

  test("listQuarantined returns empty when no records", () => {
    const items = listQuarantined();
    expect(items).toEqual([]);
  });

  test("listQuarantined finds items in quarantine lane", () => {
    // Create a quarantine item
    recordIngestion(
      { id: "test-1", source: "test" },
      { profile: "api", lane: "quarantine", extractors: [] },
      { passed: false, errors: ["Network error"], cost: 10 },
      { extractorCost: 10, verificationCost: 0, totalCost: 10 }
    );

    const items = listQuarantined();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("test-1");
    expect(items[0].lane).toBe("quarantine");
  });

  test("listQuarantined finds items with quarantine flag", () => {
    recordIngestion(
      { id: "test-2", source: "test", operatorFlags: { quarantine: true } },
      { profile: "api", lane: "deep", extractors: [] },
      { passed: false, errors: ["Requires review"], cost: 15 },
      { extractorCost: 10, verificationCost: 5, totalCost: 15 }
    );

    const items = listQuarantined();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("test-2");
    expect(items[0].operatorFlags.quarantine).toBe(true);
  });

  test("getQuarantined returns null when not found", () => {
    const item = getQuarantined("nonexistent");
    expect(item).toBeUndefined();
  });

  test("getQuarantined returns quarantine item by ID", () => {
    recordIngestion(
      { id: "test-3", source: "test" },
      { profile: "api", lane: "quarantine", extractors: [] },
      { passed: false, errors: ["Error"], cost: 5 },
      { extractorCost: 5, verificationCost: 0, totalCost: 5 }
    );

    const item = getQuarantined("test-3");
    expect(item).toBeDefined();
    expect(item?.id).toBe("test-3");
  });

  test("approveQuarantine moves item to target lane and sets forceReingest", () => {
    recordIngestion(
      { id: "test-4", source: "test" },
      { profile: "api", lane: "quarantine", extractors: [] },
      { passed: false, errors: ["Error"], cost: 5 },
      { extractorCost: 5, verificationCost: 0, totalCost: 5 }
    );

    approveQuarantine("test-4", "fast");

    // Load manifest again to check
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(2); // original + updated

    const updated = JSON.parse(lines[1]);
    expect(updated.operatorFlags.forceReingest).toBe(true);
    expect(updated.operatorFlags.quarantine).toBe(false);
    expect(updated.lane).toBe("fast");
  });

  test("rejectQuarantine sets skip flag", () => {
    recordIngestion(
      { id: "test-5", source: "test" },
      { profile: "api", lane: "quarantine", extractors: [] },
      { passed: false, errors: ["Error"], cost: 5 },
      { extractorCost: 5, verificationCost: 0, totalCost: 5 }
    );

    rejectQuarantine("test-5", "Too risky");

    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(2);

    const updated = JSON.parse(lines[1]);
    expect(updated.operatorFlags.skip).toBe(true);
    expect(updated.operatorFlags.quarantine).toBe(false);
  });

  test("approveQuarantine throws when item not found", () => {
    expect(() => approveQuarantine("nonexistent")).toThrow(
      "Quarantined record not found: nonexistent"
    );
  });

  test("rejectQuarantine throws when item not found", () => {
    expect(() => rejectQuarantine("nonexistent")).toThrow(
      "Quarantined record not found: nonexistent"
    );
  });
});
