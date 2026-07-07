"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repairManifest = repairManifest;
exports.getRepairStats = getRepairStats;
var fs = require("fs");
var path = require("path");
var MANIFEST_DIR = path.join(__dirname, "..", "..");
var MANIFEST_PATH = path.join(MANIFEST_DIR, "ingestionManifest.jsonl");
var MANIFEST_BACKUP = path.join(MANIFEST_DIR, "ingestionManifest.backup.jsonl");
var LOCK_PATH = path.join(MANIFEST_DIR, "ingestionManifest.lock");
var LOCK_TIMEOUT_MS = 5000;
function acquireLock() {
    var start = Date.now();
    while (Date.now() - start < LOCK_TIMEOUT_MS) {
        try {
            fs.writeFileSync(LOCK_PATH, "", { flag: "wx" });
            return true;
        }
        catch (_a) {
            // File exists, wait and retry
        }
    }
    return false;
}
function releaseLock() {
    try {
        fs.unlinkSync(LOCK_PATH);
    }
    catch (_a) {
        // Lock may not exist
    }
}
function validateRecord(record) {
    var requiredFields = [
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
    var missing = [];
    for (var _i = 0, requiredFields_1 = requiredFields; _i < requiredFields_1.length; _i++) {
        var field = requiredFields_1[_i];
        if (!(field in record)) {
            missing.push(field);
        }
    }
    return { valid: missing.length === 0, missingFields: missing };
}
function repairManifest() {
    // Acquire lock
    var lockAcquired = acquireLock();
    if (!lockAcquired) {
        throw new Error("Failed to acquire manifest lock after ".concat(LOCK_TIMEOUT_MS, "ms"));
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
        var content = fs.readFileSync(MANIFEST_PATH, "utf-8");
        var lines = content.split("\n").filter(function (line) { return line.trim(); });
        var stats = {
            totalLines: lines.length,
            validLines: 0,
            corruptedLines: [],
            missingFields: [],
        };
        var validRecords = [];
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            try {
                var record = JSON.parse(line);
                var validation = validateRecord(record);
                if (validation.valid) {
                    validRecords.push(record);
                    stats.validLines++;
                }
                else {
                    stats.corruptedLines.push(line.substring(0, 100));
                    stats.missingFields.push({
                        line: line.substring(0, 50),
                        fields: validation.missingFields,
                    });
                }
            }
            catch (err) {
                // JSON parse error
                stats.corruptedLines.push(line.substring(0, 100));
            }
        }
        // Backup original if corrupted lines found
        if (stats.corruptedLines.length > 0) {
            fs.copyFileSync(MANIFEST_PATH, MANIFEST_BACKUP);
        }
        // Rewrite manifest with valid records only
        var cleanContent = validRecords
            .map(function (r) { return JSON.stringify(r); })
            .join("\n");
        if (cleanContent) {
            fs.writeFileSync(MANIFEST_PATH, cleanContent + "\n", { flag: "w" });
        }
        else {
            fs.writeFileSync(MANIFEST_PATH, "", { flag: "w" });
        }
        // fsync
        var fd = fs.openSync(MANIFEST_PATH, "a");
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        return stats;
    }
    finally {
        releaseLock();
    }
}
function getRepairStats() {
    if (!fs.existsSync(MANIFEST_PATH)) {
        return {
            totalLines: 0,
            validLines: 0,
            corruptedLines: [],
            missingFields: [],
        };
    }
    var content = fs.readFileSync(MANIFEST_PATH, "utf-8");
    var lines = content.split("\n").filter(function (line) { return line.trim(); });
    var stats = {
        totalLines: lines.length,
        validLines: 0,
        corruptedLines: [],
        missingFields: [],
    };
    for (var _i = 0, lines_2 = lines; _i < lines_2.length; _i++) {
        var line = lines_2[_i];
        try {
            var record = JSON.parse(line);
            var validation = validateRecord(record);
            if (validation.valid) {
                stats.validLines++;
            }
            else {
                stats.corruptedLines.push(line.substring(0, 100));
                stats.missingFields.push({
                    line: line.substring(0, 50),
                    fields: validation.missingFields,
                });
            }
        }
        catch (err) {
            stats.corruptedLines.push(line.substring(0, 100));
        }
    }
    return stats;
}
