#!/usr/bin/env node
/**
 * ingestion-quarantine-cli-gate.ts
 * Phase 27 Wave D: Verify quarantine CLI commands work
 */

import * as fs from "fs";
import * as path from "path";
import { recordIngestion } from "./ingestionManifest";
import {
  listQuarantined,
  getQuarantined,
  approveQuarantine,
  rejectQuarantine,
} from "./quarantineReview";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");

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

function setup(): void {
  // Clean up manifest
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.unlinkSync(MANIFEST_PATH);
  }
  if (fs.existsSync(LOCK_PATH)) {
    fs.unlinkSync(LOCK_PATH);
  }

  // Create test quarantine items
  recordIngestion(
    { id: "q-001", source: "api.example.com", operatorFlags: {} },
    { profile: "api", lane: "quarantine", extractors: ["http"] },
    { passed: false, errors: ["HTTP 500 from endpoint"], cost: 10 },
    { extractorCost: 10, verificationCost: 0, totalCost: 10 }
  );

  recordIngestion(
    { id: "q-002", source: "file.zip", operatorFlags: { quarantine: true } },
    { profile: "filesystem", lane: "deep", extractors: ["zip-extract"] },
    { passed: false, errors: ["Corrupted zip header"], cost: 25 },
    { extractorCost: 20, verificationCost: 5, totalCost: 25 }
  );
}

function testListCommand(): void {
  console.log("\n[Gate] Testing quarantine:list command");
  const items = listQuarantined();
  assert(items.length === 2, "Found 2 quarantined items");
  assert(items.some((i) => i.id === "q-001"), "Item q-001 found");
  assert(items.some((i) => i.id === "q-002"), "Item q-002 found");
}

function testGetCommand(): void {
  console.log("\n[Gate] Testing getQuarantined function");
  const item = getQuarantined("q-001");
  assert(item !== undefined, "getQuarantined returns item");
  assert(item?.source === "api.example.com", "Item source correct");
  assert(item?.lane === "quarantine", "Item in quarantine lane");

  const missing = getQuarantined("nonexistent");
  assert(missing === undefined, "getQuarantined returns undefined for missing item");
}

function testApproveCommand(): void {
  console.log("\n[Gate] Testing quarantine:approve command");
  try {
    approveQuarantine("q-001", "fast");
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    assert(lines.length === 3, "Manifest has 3 lines (original + updated + q-002)");

    const updated = JSON.parse(lines[1]);
    assert(updated.operatorFlags.forceReingest === true, "forceReingest flag set");
    assert(updated.operatorFlags.quarantine === false, "quarantine flag cleared");
    assert(updated.lane === "fast", "Lane changed to fast");
  } catch (e) {
    assert(false, `Approval command failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function testRejectCommand(): void {
  console.log("\n[Gate] Testing quarantine:reject command");
  try {
    rejectQuarantine("q-002", "Too risky for auto-processing");
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    const updated = JSON.parse(lines[lines.length - 1]); // Last line
    assert(updated.operatorFlags.skip === true, "skip flag set");
    assert(updated.operatorFlags.quarantine === false, "quarantine flag cleared");
  } catch (e) {
    assert(false, `Rejection command failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function testErrorHandling(): void {
  console.log("\n[Gate] Testing error handling");

  try {
    approveQuarantine("nonexistent-id", "fast");
    assert(false, "Approve should throw for nonexistent ID");
  } catch (e) {
    assert(
      e instanceof Error && e.message.includes("not found"),
      "Approve throws for nonexistent ID"
    );
  }

  try {
    rejectQuarantine("nonexistent-id");
    assert(false, "Reject should throw for nonexistent ID");
  } catch (e) {
    assert(
      e instanceof Error && e.message.includes("not found"),
      "Reject throws for nonexistent ID"
    );
  }
}

function cleanup(): void {
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.unlinkSync(MANIFEST_PATH);
  }
  if (fs.existsSync(LOCK_PATH)) {
    fs.unlinkSync(LOCK_PATH);
  }
}

// ============================================================================
// RUN GATE
// ============================================================================

console.log("=========================================");
console.log("ingestion-quarantine-cli-gate");
console.log("Phase 27 Wave D: Quarantine CLI validation");
console.log("=========================================");

try {
  setup();
  testListCommand();
  testGetCommand();
  testApproveCommand();
  testRejectCommand();
  testErrorHandling();

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
