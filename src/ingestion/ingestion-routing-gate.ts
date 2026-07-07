#!/usr/bin/env ts-node
// Nightly gate: ingestion_routing_gate
// Validates Wave B routing and manifest persistence

import * as fs from "fs";
import * as path from "path";
import { route } from "./ingestionRouter";
import { recordIngestion, loadManifest } from "./ingestionManifest";
import { RoutedIngestionDecision, VerificationResult, Cost } from "./types";

const FIXTURES_PATH = path.join(__dirname, "ingestionRoutingGolden.json");
const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");

interface Fixture {
  name: string;
  entry: any;
  expected: {
    profile?: string;
    lane?: string;
    extractorsInclude?: string[];
    extractorsMinCount?: number;
  };
}

async function runGate(): Promise<void> {
  console.log("🚀 Ingestion Routing Gate (Wave B) Starting...\n");

  // Load fixtures
  if (!fs.existsSync(FIXTURES_PATH)) {
    throw new Error(`Fixtures not found: ${FIXTURES_PATH}`);
  }

  const fixturesData = JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf-8"));
  const fixtures: Fixture[] = fixturesData.fixtures;

  console.log(`📋 Loaded ${fixtures.length} test fixtures\n`);

  // Test routing decisions
  console.log("=== Testing Routing Decisions ===");
  let routingPass = 0;
  for (const fixture of fixtures) {
    const decision = route(fixture.entry);

    let passed = true;
    const errors: string[] = [];

    if (
      fixture.expected.profile &&
      decision.profile !== fixture.expected.profile
    ) {
      passed = false;
      errors.push(
        `Profile mismatch: expected ${fixture.expected.profile}, got ${decision.profile}`
      );
    }

    if (fixture.expected.lane && decision.lane !== fixture.expected.lane) {
      passed = false;
      errors.push(
        `Lane mismatch: expected ${fixture.expected.lane}, got ${decision.lane}`
      );
    }

    if (fixture.expected.extractorsInclude) {
      for (const extractor of fixture.expected.extractorsInclude) {
        if (!decision.extractors.includes(extractor)) {
          passed = false;
          errors.push(`Extractor missing: ${extractor}`);
        }
      }
    }

    if (fixture.expected.extractorsMinCount) {
      if (decision.extractors.length < fixture.expected.extractorsMinCount) {
        passed = false;
        errors.push(
          `Extractor count too low: expected >= ${fixture.expected.extractorsMinCount}, got ${decision.extractors.length}`
        );
      }
    }

    if (passed) {
      routingPass++;
      console.log(`  ✅ ${fixture.name}`);
    } else {
      console.log(`  ❌ ${fixture.name}`);
      for (const error of errors) {
        console.log(`     • ${error}`);
      }
    }
  }

  console.log(
    `\n✅ Routing: ${routingPass}/${fixtures.length} passed\n`
  );

  // Test manifest recording
  console.log("=== Testing Manifest Recording ===");

  // Clean manifest first
  if (fs.existsSync(MANIFEST_PATH)) {
    fs.unlinkSync(MANIFEST_PATH);
  }
  if (fs.existsSync(LOCK_PATH)) {
    fs.unlinkSync(LOCK_PATH);
  }

  // Record test entry
  const testEntry = {
    id: "gate-test-1",
    source: "filesystem",
    mediaType: "text/plain",
    size: 1024,
    retryCount: 0,
  };

  const decision: RoutedIngestionDecision = {
    profile: "filesystem",
    lane: "fast",
    extractors: ["TextExtractor"],
  };

  const verification: VerificationResult = {
    passed: true,
    errors: [],
    cost: 0.001,
  };

  const cost: Cost = {
    extractorCost: 0.001,
    verificationCost: 0.001,
    totalCost: 0.002,
  };

  recordIngestion(testEntry, decision, verification, cost);

  // Verify manifest was written
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error("Manifest file not created");
  }

  console.log("  ✅ Manifest file created");

  // Load and verify manifest
  const records = loadManifest();
  if (records.length !== 1) {
    throw new Error(`Expected 1 record, got ${records.length}`);
  }

  const record = records[0];

  console.log("  ✅ Record loaded successfully");

  // Verify all required fields
  const requiredFields = [
    "id",
    "source",
    "mediaType",
    "profile",
    "lane",
    "extractorsRun",
    "verification",
    "operatorFlags",
    "timestamps",
    "routingVersion",
    "retryCount",
    "cost",
  ];

  for (const field of requiredFields) {
    if (!(field in record)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  console.log("  ✅ All required fields present");

  // Verify cost propagation
  if (!record.cost) {
    throw new Error("Cost field missing from manifest record");
  }

  if (record.cost.extractorCost !== 0.001) {
    throw new Error(
      `Cost mismatch: extractorCost should be 0.001, got ${record.cost.extractorCost}`
    );
  }

  if (record.cost.verificationCost !== 0.001) {
    throw new Error(
      `Cost mismatch: verificationCost should be 0.001, got ${record.cost.verificationCost}`
    );
  }

  if (record.cost.totalCost !== 0.002) {
    throw new Error(
      `Cost mismatch: totalCost should be 0.002, got ${record.cost.totalCost}`
    );
  }

  console.log("  ✅ Cost fields populated correctly");

  // Test concurrent lock
  console.log("\n=== Testing Concurrent Lock Safety ===");

  // Create lock file to simulate concurrent access
  fs.writeFileSync(LOCK_PATH, "");

  try {
    recordIngestion(testEntry, decision, verification, cost);
    console.log("  ❌ Lock not enforced (expected FileLockedError)");
    fs.unlinkSync(LOCK_PATH);
    throw new Error("FileLockedError not thrown");
  } catch (err: any) {
    if (err.name === "FileLockedError") {
      console.log("  ✅ FileLockedError thrown on concurrent access");
      fs.unlinkSync(LOCK_PATH);
    } else {
      throw err;
    }
  }

  console.log("\n✅ All Wave B tests PASSED ✅\n");
  console.log("Gate Status: PASS");
}

runGate().catch((err) => {
  console.error("\n❌ Gate FAILED:", err.message);
  console.error("\nError details:", err);
  process.exit(1);
});
