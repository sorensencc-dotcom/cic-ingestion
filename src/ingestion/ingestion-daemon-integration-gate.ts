#!/usr/bin/env ts-node
// Nightly gate: ingestion_daemon_integration_gate
// Validates Wave C daemon integration with routing

import * as fs from "fs";
import * as path from "path";
import { route } from "./ingestionRouter.js";
import { recordIngestion, loadManifest } from "./ingestionManifest.js";
import { getOverrideForEntry, applyOverride, loadOperatorOverrides } from "./operatorOverrides.js";
import {
  RoutedIngestionDecision,
  VerificationResult,
  Cost,
} from "./types.js";

const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");

async function runGate(): Promise<void> {
  console.log("🚀 Ingestion Daemon Integration Gate (Wave C) Starting...\n");

  // Clean up manifest
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.unlinkSync(MANIFEST_PATH);
  }
  if (fs.existsSync(LOCK_PATH)) {
    fs.unlinkSync(LOCK_PATH);
  }

  console.log("=== Testing Routing + Manifest Integration ===");

  // Test 1: Normal flow (route → extract → verify → record)
  console.log("\n✓ Test 1: Normal ingestion flow");
  const entry1 = {
    id: "gate-flow-1",
    source: "filesystem",
    mediaType: "text/plain",
    size: 1024,
    retryCount: 0,
  };

  const decision1 = route(entry1);
  console.log(`  • Routed to ${decision1.profile}/${decision1.lane}`);

  const verification1: VerificationResult = {
    passed: true,
    errors: [],
    cost: 0.001,
  };

  const cost1: Cost = {
    extractorCost: 0.001,
    verificationCost: 0.001,
    totalCost: 0.002,
  };

  recordIngestion(entry1, decision1, verification1, cost1);
  console.log("  • Recorded to manifest");

  const records = loadManifest();
  if (records.length !== 1) {
    throw new Error(`Expected 1 record after normal flow, got ${records.length}`);
  }
  console.log("  ✅ Normal flow works");

  // Test 2: Operator override flow
  console.log("\n✓ Test 2: Operator override flow");

  const overrides = loadOperatorOverrides();
  console.log(`  • Loaded ${Object.keys(overrides).length} operator overrides (expected 0 in gate)`);

  const entry2 = {
    id: "gate-override-1",
    source: "api:generic",
    mediaType: "application/json",
    size: 5000,
    retryCount: 0,
  };

  const decision2 = route(entry2);
  console.log(`  • Initial routing: ${decision2.profile}/${decision2.lane}`);

  // Simulate operator override
  const override = {
    overrideProfile: "images",
    overrideLane: "deep" as const,
  };

  const applied = applyOverride(entry2, override);
  console.log(
    `  • Applied override: profile=${applied.profile}, lane=${applied.lane}`
  );

  const verification2: VerificationResult = {
    passed: true,
    errors: [],
    cost: 0.001,
  };

  const cost2: Cost = {
    extractorCost: 0.002,
    verificationCost: 0.002,
    totalCost: 0.004,
  };

  const overriddenDecision: RoutedIngestionDecision = {
    profile: applied.profile || decision2.profile,
    lane: applied.lane || decision2.lane,
    extractors: decision2.extractors,
  };

  recordIngestion(entry2, overriddenDecision, verification2, cost2);
  console.log("  • Recorded override to manifest");

  const records2 = loadManifest();
  if (records2.length !== 2) {
    throw new Error(`Expected 2 records after override, got ${records2.length}`);
  }

  const overrideRecord = records2.find((r) => r.id === "gate-override-1");
  if (!overrideRecord) {
    throw new Error("Override record not found");
  }

  if (overrideRecord.profile !== "images") {
    throw new Error(
      `Override profile should be 'images', got '${overrideRecord.profile}'`
    );
  }

  console.log("  ✅ Operator override works");

  // Test 3: Quarantine path (failed verification + deep lane)
  console.log("\n✓ Test 3: Quarantine path");

  const entry3 = {
    id: "gate-quarantine-1",
    source: "images",
    mediaType: "image/jpeg",
    size: 2000000,
    retryCount: 0,
  };

  const decision3 = route(entry3);
  console.log(`  • Routed to ${decision3.profile}/${decision3.lane}`);

  const verification3: VerificationResult = {
    passed: false,
    errors: ["Schema validation failed"],
    cost: 0.003,
  };

  const cost3: Cost = {
    extractorCost: 0.003,
    verificationCost: 0.003,
    totalCost: 0.006,
  };

  recordIngestion(entry3, decision3, verification3, cost3);
  console.log("  • Recorded failed verification to manifest");

  const records3 = loadManifest();
  const quarantineRecord = records3.find((r) => r.id === "gate-quarantine-1");

  if (!quarantineRecord) {
    throw new Error("Quarantine record not found");
  }

  if (quarantineRecord.verification.passed !== false) {
    throw new Error("Quarantine record should have failed verification");
  }

  if (quarantineRecord.lane !== "deep") {
    throw new Error(
      `Quarantine record should be on deep lane, got ${quarantineRecord.lane}`
    );
  }

  console.log("  ✅ Quarantine path works");

  // Test 4: DLQ path (failed verification + fast lane)
  console.log("\n✓ Test 4: DLQ path");

  const entry4 = {
    id: "gate-dlq-1",
    source: "filesystem",
    mediaType: "text/plain",
    size: 1024,
    retryCount: 0,
  };

  const decision4 = route(entry4);
  console.log(`  • Routed to ${decision4.profile}/${decision4.lane}`);

  const verification4: VerificationResult = {
    passed: false,
    errors: ["Parsing error"],
    cost: 0.002,
  };

  const cost4: Cost = {
    extractorCost: 0.002,
    verificationCost: 0.002,
    totalCost: 0.004,
  };

  recordIngestion(entry4, decision4, verification4, cost4);
  console.log("  • Recorded failed verification to manifest");

  const records4 = loadManifest();
  const dlqRecord = records4.find((r) => r.id === "gate-dlq-1");

  if (!dlqRecord) {
    throw new Error("DLQ record not found");
  }

  if (dlqRecord.lane !== "fast") {
    throw new Error(`DLQ record should be on fast lane, got ${dlqRecord.lane}`);
  }

  console.log("  ✅ DLQ path works");

  // Test 5: Cost propagation
  console.log("\n✓ Test 5: Cost propagation");

  const allRecords = loadManifest();

  let costValid = true;
  for (const record of allRecords) {
    if (!record.cost) {
      console.log(`  ⚠️  Record ${record.id} missing cost field`);
      costValid = false;
    } else {
      const expected = record.cost.extractorCost + record.cost.verificationCost;
      if (Math.abs(record.cost.totalCost - expected) > 0.0001) {
        console.log(
          `  ⚠️  Record ${record.id} cost mismatch: ${record.cost.totalCost} != ${expected}`
        );
        costValid = false;
      }
    }
  }

  if (!costValid) {
    throw new Error("Cost propagation validation failed");
  }

  console.log("  ✅ Cost propagation validated");

  console.log("\n✅ All Wave C tests PASSED ✅\n");
  console.log("Gate Status: PASS");
}

runGate().catch((err) => {
  console.error("\n❌ Gate FAILED:", err.message);
  process.exit(1);
});
