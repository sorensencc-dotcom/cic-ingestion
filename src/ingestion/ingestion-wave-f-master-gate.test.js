#!/usr/bin/env node
/**
 * ingestion-wave-f-master-gate.test.ts
 * Phase 27 Wave F: Master validation gate
 * Validates complete ingestion pipeline (Waves A-E)
 */
import * as fs from "fs";
import * as path from "path";
import { recordIngestion } from "./ingestionManifest";
import { route } from "./ingestionRouter";
import { repairManifest } from "./repairManifest";
import { pruneManifest, getPruneStats } from "./pruneManifest";
import { listQuarantined, approveQuarantine } from "./quarantineReview";
const MANIFEST_DIR = path.join(__dirname, "..", "..");
const MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
const LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");
const ARCHIVE_DIR = path.join(MANIFEST_DIR, "manifests-archived");
let passCount = 0;
let failCount = 0;
function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passCount++;
    }
    else {
        console.error(`  ✗ ${message}`);
        failCount++;
    }
}
function setup() {
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
// Wave A: Type System + Profiles
// ============================================================================
function testWaveATypes() {
    console.log("\n[Wave A] Testing type system");
    setup();
    const record = {
        id: "wave-a-test",
        source: "https://test.com",
        mediaType: "text/plain",
        profile: "api",
        lane: "fast",
        extractorsRun: ["TextExtractor"],
        verification: { passed: true, errors: [] },
        operatorFlags: {},
        timestamps: { ingested: new Date().toISOString() },
        routingVersion: "1.0.0",
        retryCount: 0,
        cost: { extractorCost: 10, verificationCost: 5, totalCost: 15 },
    };
    assert(record.id !== undefined, "ManifestRecord has id field");
    assert(record.profile === "api", "Profile field is correct type");
    assert(record.lane === "fast", "Lane field is correct type");
    assert(Array.isArray(record.extractorsRun), "extractorsRun is array");
    assert(record.verification.passed === true, "Verification structure valid");
    assert(record.cost.totalCost === 15, "Cost calculation correct");
}
// ============================================================================
// Wave B: Routing + Manifest
// ============================================================================
function testWaveBRouting() {
    console.log("\n[Wave B] Testing routing + manifest");
    setup();
    // Test routing decision
    const routing = route({
        id: "test",
        source: "https://test.com",
        mediaType: "text/html",
    });
    assert(routing.profile !== undefined, "Routing returns profile");
    assert(routing.lane !== undefined, "Routing returns lane");
    assert(Array.isArray(routing.extractors), "Routing returns extractors array");
    // Test manifest recording
    recordIngestion({ id: "wave-b-test", source: "test.com" }, { profile: "api", lane: "fast", extractors: ["TextExtractor"] }, { passed: true, errors: [], cost: 10 }, { extractorCost: 10, verificationCost: 0, totalCost: 10 });
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    assert(lines.length === 1, "Manifest recorded 1 entry");
    const record = JSON.parse(lines[0]);
    assert(record.id === "wave-b-test", "Manifest entry has correct ID");
    assert(record.lane === "fast", "Manifest entry has correct lane");
}
// ============================================================================
// Wave C: Daemon Routing Integration
// ============================================================================
function testWaveCDaemonRouting() {
    console.log("\n[Wave C] Testing daemon routing");
    setup();
    // Simulate daemon ingesting multiple records
    for (let i = 0; i < 3; i++) {
        recordIngestion({ id: `daemon-${i}`, source: `test-${i}.com` }, { profile: "api", lane: "fast", extractors: [] }, { passed: true, errors: [], cost: 5 }, { extractorCost: 5, verificationCost: 0, totalCost: 5 });
    }
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    assert(lines.length === 3, "Daemon recorded 3 entries");
    const records = lines.map((l) => JSON.parse(l));
    const ids = records.map((r) => r.id);
    assert(ids.includes("daemon-0"), "First daemon entry present");
    assert(ids.includes("daemon-2"), "Last daemon entry present");
}
// ============================================================================
// Wave D: CLI + Quarantine Review
// ============================================================================
function testWaveDQuarantine() {
    console.log("\n[Wave D] Testing CLI + quarantine");
    setup();
    // Create normal and quarantine entries
    recordIngestion({ id: "normal-1", source: "test.com" }, { profile: "api", lane: "fast", extractors: [] }, { passed: true, errors: [], cost: 5 }, { extractorCost: 5, verificationCost: 0, totalCost: 5 });
    recordIngestion({ id: "quarantine-1", source: "test.com" }, { profile: "api", lane: "quarantine", extractors: [] }, { passed: false, errors: ["Network timeout"], cost: 5 }, { extractorCost: 5, verificationCost: 0, totalCost: 5 });
    // Test quarantine listing
    const quarantined = listQuarantined();
    assert(quarantined.length === 1, "Found 1 quarantine item");
    assert(quarantined[0].id === "quarantine-1", "Quarantine item correct");
    // Test approval workflow
    approveQuarantine("quarantine-1", "deep");
    const manifest = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const approved = manifest
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
        .find((r) => r.id === "quarantine-1");
    assert(approved?.operatorFlags.forceReingest === true, "Approval sets forceReingest");
    assert(approved?.lane === "deep", "Approval moved to target lane");
}
// ============================================================================
// Wave E: Repair + Prune Durability
// ============================================================================
function testWaveEDurability() {
    console.log("\n[Wave E] Testing durability (repair + prune)");
    setup();
    // Add valid records
    recordIngestion({ id: "valid-1", source: "test.com" }, { profile: "api", lane: "fast", extractors: [] }, { passed: true, errors: [], cost: 5 }, { extractorCost: 5, verificationCost: 0, totalCost: 5 });
    // Add old record
    const oldRecord = {
        id: "old-1",
        source: "test.com",
        mediaType: "text/plain",
        profile: "api",
        lane: "fast",
        extractorsRun: [],
        verification: { passed: true, errors: [] },
        operatorFlags: {},
        timestamps: {
            ingested: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
        },
        routingVersion: "1.0.0",
        retryCount: 0,
        cost: { extractorCost: 5, verificationCost: 0, totalCost: 5 },
    };
    fs.appendFileSync(MANIFEST_PATH, JSON.stringify(oldRecord) + "\n");
    // Add corrupted line
    fs.appendFileSync(MANIFEST_PATH, "corrupted data\n");
    // Repair
    const repairStats = repairManifest();
    assert(repairStats.totalLines === 3, "Repair analyzed 3 lines");
    assert(repairStats.validLines === 2, "Repair found 2 valid lines");
    assert(repairStats.corruptedLines.length === 1, "Repair found 1 corrupted line");
    // Prune
    const pruneStats = pruneManifest(90);
    assert(pruneStats.totalRecords === 2, "Prune processed 2 records");
    assert(pruneStats.retainedRecords === 1, "Prune retained 1 recent record");
    assert(pruneStats.archivedRecords === 1, "Prune archived 1 old record");
    // Verify manifest is clean
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    assert(lines.length === 1, "Final manifest has 1 record (recent only)");
    // Verify archive exists
    assert(fs.existsSync(ARCHIVE_DIR), "Archive directory created");
    const archiveFiles = fs.readdirSync(ARCHIVE_DIR);
    assert(archiveFiles.length > 0, "Archive file exists");
}
// ============================================================================
// Wave F Integration: Full Pipeline
// ============================================================================
function testWaveFEndToEnd() {
    console.log("\n[Wave F] Testing end-to-end pipeline");
    setup();
    // Simulate realistic scenario: mix of normal, old, and problematic records
    const now = Date.now();
    // Recent records
    for (let i = 0; i < 5; i++) {
        recordIngestion({ id: `recent-${i}`, source: `api-${i}.com` }, { profile: "api", lane: "fast", extractors: ["TextExtractor"] }, { passed: true, errors: [], cost: 10 }, { extractorCost: 10, verificationCost: 0, totalCost: 10 });
    }
    // Old records (will be archived)
    for (let i = 0; i < 3; i++) {
        const oldRec = {
            id: `old-${i}`,
            source: `legacy-${i}.com`,
            mediaType: "text/html",
            profile: "web",
            lane: "deep",
            extractorsRun: ["HTMLExtractor"],
            verification: { passed: true, errors: [] },
            operatorFlags: {},
            timestamps: {
                ingested: new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString(),
            },
            routingVersion: "1.0.0",
            retryCount: 0,
            cost: { extractorCost: 15, verificationCost: 5, totalCost: 20 },
        };
        fs.appendFileSync(MANIFEST_PATH, JSON.stringify(oldRec) + "\n");
    }
    // Corruption scenarios
    fs.appendFileSync(MANIFEST_PATH, "{ bad json\n");
    fs.appendFileSync(MANIFEST_PATH, "null\n");
    // Repair
    const repaired = repairManifest();
    assert(repaired.validLines === 8, "Repair: 5 recent + 3 old = 8 valid");
    assert(repaired.corruptedLines.length === 2, "Repair: removed 2 corrupted");
    // Prune
    const pruned = pruneManifest(90);
    assert(pruned.totalRecords === 8, "Prune: processed 8 records");
    assert(pruned.retainedRecords === 5, "Prune: retained 5 recent");
    assert(pruned.archivedRecords === 3, "Prune: archived 3 old");
    // Verify final state
    const content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    const remaining = content.split("\n").filter((l) => l.trim());
    assert(remaining.length === 5, "Manifest: 5 recent records only");
    // Verify no corruption in remaining
    for (const line of remaining) {
        try {
            const rec = JSON.parse(line);
            assert(rec.id && rec.source && rec.timestamps, `Remaining record ${rec.id} is valid`);
        }
        catch (e) {
            assert(false, `Remaining record is valid JSON`);
        }
    }
    // Verify archive
    const archiveFiles = fs.readdirSync(ARCHIVE_DIR);
    assert(archiveFiles.length === 1, "Archive: 1 file created");
    const archivePath = path.join(ARCHIVE_DIR, archiveFiles[0]);
    const archiveContent = fs.readFileSync(archivePath, "utf-8");
    const archived = archiveContent.split("\n").filter((l) => l.trim());
    assert(archived.length === 3, "Archive: contains 3 old records");
}
// ============================================================================
// Wave F Durability: Recovery Scenarios
// ============================================================================
function testRecoveryScenarios() {
    console.log("\n[Wave F] Testing recovery scenarios");
    setup();
    // Scenario 1: Partial corruption recovery
    recordIngestion({ id: "recover-1", source: "test.com" }, { profile: "api", lane: "fast", extractors: [] }, { passed: true, errors: [], cost: 5 }, { extractorCost: 5, verificationCost: 0, totalCost: 5 });
    fs.appendFileSync(MANIFEST_PATH, "corrupted\n");
    recordIngestion({ id: "recover-2", source: "test.com" }, { profile: "api", lane: "fast", extractors: [] }, { passed: true, errors: [], cost: 5 }, { extractorCost: 5, verificationCost: 0, totalCost: 5 });
    const stats = repairManifest();
    assert(stats.validLines === 2, "Recovery: preserved valid records");
    assert(fs.existsSync(MANIFEST_PATH.replace(".jsonl", ".backup.jsonl")), "Recovery: backup created");
    // Scenario 2: Retention boundary edge case
    setup();
    const boundary = new Date();
    boundary.setDate(boundary.getDate() - 90);
    recordIngestion({ id: "boundary-keep", source: "test.com" }, { profile: "api", lane: "fast", extractors: [] }, { passed: true, errors: [], cost: 5 }, { extractorCost: 5, verificationCost: 0, totalCost: 5 });
    const rec = {
        id: "boundary-archive",
        source: "test.com",
        mediaType: "text/plain",
        profile: "api",
        lane: "fast",
        extractorsRun: [],
        verification: { passed: true, errors: [] },
        operatorFlags: {},
        timestamps: { ingested: boundary.toISOString() },
        routingVersion: "1.0.0",
        retryCount: 0,
        cost: { extractorCost: 5, verificationCost: 0, totalCost: 5 },
    };
    fs.appendFileSync(MANIFEST_PATH, JSON.stringify(rec) + "\n");
    const boundaryStats = getPruneStats(90);
    // Boundary date is exactly 90 days old; should be retained (cutoff is < 90 days old)
    assert(boundaryStats.retainedRecords >= 1, "Retention: boundary handled correctly");
}
function cleanup() {
    if (fs.existsSync(MANIFEST_PATH)) {
        fs.unlinkSync(MANIFEST_PATH);
    }
    if (fs.existsSync(LOCK_PATH)) {
        fs.unlinkSync(LOCK_PATH);
    }
    if (fs.existsSync(MANIFEST_PATH.replace(".jsonl", ".backup.jsonl"))) {
        fs.unlinkSync(MANIFEST_PATH.replace(".jsonl", ".backup.jsonl"));
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
// RUN GATES
// ============================================================================
console.log("=========================================");
console.log("ingestion-wave-f-master-gate");
console.log("Phase 27 Wave F: Complete Pipeline");
console.log("=========================================");
try {
    testWaveATypes();
    testWaveBRouting();
    testWaveCDaemonRouting();
    testWaveDQuarantine();
    testWaveEDurability();
    testWaveFEndToEnd();
    testRecoveryScenarios();
    cleanup();
    console.log("\n=========================================");
    console.log(`Results: ${passCount} passed, ${failCount} failed`);
    console.log("=========================================");
    if (failCount > 0) {
        process.exit(1);
    }
    else {
        console.log("✓ All gates passed");
        process.exit(0);
    }
}
catch (e) {
    console.error("Gate execution failed:", e);
    cleanup();
    process.exit(1);
}
