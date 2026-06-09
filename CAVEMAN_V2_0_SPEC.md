# Caveman v2.0 Specification

**Status:** Locked  
**Date:** 2026-06-08  
**Modes:** raw | semantic | ast | diff

---

## Overview

Caveman v2.0 adds **semantic**, **AST**, and **diff** compression modes to complement the original **raw** mode.

**Goal:** Reduce data volume while preserving meaning and structure, under governance control.

---

## Compression Modes

### 1. RAW Mode (v1)

**Description:** Original Caveman compression (v1 behavior preserved).

**Algorithm:**
- Remove whitespace, indent
- Strip comments
- Collapse arrays/objects
- Remove redundancy

**Compression ratio:** 1.5x–2x

**Use case:** General-purpose, safe

**Risk:** Low

**Governance:** Default for critical paths

### 2. SEMANTIC Mode

**Description:** Meaning-preserving compression for text (logs, chat, narrative).

**Algorithm:**
- Parse text
- Extract semantic tokens (key phrases, entities, values)
- Collapse verbose patterns
- Keep essential meaning

**Compression ratio:** 2x–4x

**Examples:**

```
Input:
{
  "message": "User attempted to execute shell command 'ls -la /tmp' but was denied by security policy due to path restriction",
  "severity": "warn",
  "timestamp": "2026-06-08T20:15:30.123Z"
}

Output:
{
  "msg": "user shell ls /tmp denied path",
  "sev": "w",
  "ts": "26-06-08T20:15Z"
}
```

**Use case:** Logs, chat, narrative, user-facing text

**Risk:** Medium (could lose nuance)

**Governance:** Allowed for non-critical logs

### 3. AST Mode

**Description:** Structure-preserving compression for code (never changes semantics or AST structure).

**Algorithm:**
- Parse to AST (if language detected)
- Normalize whitespace/comments
- Collapse redundant syntax
- Re-serialize preserving structure

**Compression ratio:** 1.5x–3x

**Examples:**

```
Input (JavaScript):
function calculateSum(arr) {
  let total = 0;
  for (let i = 0; i < arr.length; i++) {
    total += arr[i];
  }
  return total;
}

Output:
function calculateSum(arr){let total=0;for(let i=0;i<arr.length;i++)total+=arr[i];return total;}
```

**Language hints:**
- `javascript` / `typescript`
- `python`
- `json`
- `sql`
- `yaml`

**Use case:** Code artifacts, tool outputs marked as code

**Risk:** Low (AST structure preserved)

**Governance:** Allowed for code outputs

### 4. DIFF Mode

**Description:** Change-focused compression (only transmit delta from baseline).

**Algorithm:**
- Compute baseline hash
- Compute delta (diff)
- Compress delta (often much smaller)
- Include baseline hash + delta

**Compression ratio:** 5x–10x (for incremental updates)

**Example:**

```
Baseline (hash: abc123):
{
  "state": {
    "memory": 1024,
    "agents": 7,
    "tools": 15,
    "phase": "1.0"
  }
}

Update:
{
  "baseline_hash": "abc123",
  "delta": {
    "state.memory": 2048,
    "state.tools": 16
  }
}

Compressed delta:
{
  "bh": "abc123",
  "d": {"sm":2048,"st":16}
}
```

**Use case:** State updates, long-running sessions, CIC internal state

**Risk:** Medium (requires baseline tracking)

**Governance:** Preferred for CIC state, TorqueQuery patches

---

## Data Structures

### CavemanOptionsV2

```typescript
export interface CavemanOptionsV2 {
  mode: CavemanModeV2;          // "raw" | "semantic" | "ast" | "diff"
  languageHint?: string;         // for AST mode: "javascript", "python", etc
  baselineHash?: string;         // for DIFF mode: hash of previous state
  preserveFieldNames?: boolean;  // if true, don't abbreviate field names
}

export type CavemanModeV2 = "raw" | "semantic" | "ast" | "diff";
```

### CavemanResultV2

```typescript
export interface CavemanResultV2<T = unknown> {
  data: T;
  stats: CavemanStatsV2;
}

export interface CavemanStatsV2 {
  // v1 fields
  schema_version: "2.0";
  bytes_in: number;
  bytes_out: number;
  bytes_saved: number;
  ratio: number;                       // bytes_out / bytes_in
  arrays_processed: number;
  objects_processed: number;
  recompression_blocked: boolean;
  pipeline_stage: string;
  timestamp: number;                   // milliseconds since epoch

  // v2 fields
  compression_profile: CavemanModeV2;  // which mode was used
  ast_nodes_processed?: number;        // for AST mode
  languages_detected?: string[];       // for AST mode
  diff_bytes_in?: number;              // for DIFF mode
  diff_bytes_out?: number;             // for DIFF mode
  diff_ratio?: number;                 // for DIFF mode
  governance_decision?: string;        // "approved" | "blocked" | "rate_limited"
}
```

---

## CavemanCompressorV2 Class

```typescript
import { Logger } from "../observability/Logger";
import { GovernanceEngine } from "../governance/GovernanceEngine";
import { CavemanBudget } from "../caveman/CavemanBudget";

export class CavemanCompressorV2 {
  constructor(
    private config: CavemanConfigV2,
    private governance: GovernanceEngine,
    private budget: CavemanBudget,
    private logger: Logger
  ) {}

  /**
   * Compress payload using specified mode
   */
  compress<T>(payload: T, opts: CavemanOptionsV2): CavemanResultV2<T> {
    // 1. Check governance
    const govDecision = this.governance.checkCavemanCompression(opts.mode);
    if (!govDecision.allowed) {
      this.logger.warn("caveman.compression_blocked", { reason: govDecision.reason });
      return {
        data: payload,
        stats: this.buildStats(opts.mode, "blocked"),
      };
    }

    // 2. Check budget
    const budgetOk = this.budget.checkBudget(opts.mode);
    if (!budgetOk) {
      this.logger.warn("caveman.budget_exhausted", { mode: opts.mode });
      return {
        data: payload,
        stats: this.buildStats(opts.mode, "rate_limited"),
      };
    }

    // 3. Compress based on mode
    let result: CavemanResultV2<T>;
    switch (opts.mode) {
      case "semantic":
        result = this.semanticCompress(payload, opts);
        break;
      case "ast":
        result = this.astCompress(payload, opts);
        break;
      case "diff":
        result = this.diffCompress(payload, opts);
        break;
      default:
        result = this.rawCompress(payload, opts);
    }

    // 4. Update budget
    this.budget.recordUsage(opts.mode, result.stats.bytes_out);

    // 5. Update metrics
    this.logger.info("caveman.compression_complete", {
      mode: opts.mode,
      ratio: result.stats.ratio,
      bytes_saved: result.stats.bytes_saved,
    });

    return result;
  }

  /**
   * RAW mode (v1 behavior)
   */
  private rawCompress<T>(payload: T, opts: CavemanOptionsV2): CavemanResultV2<T> {
    const before = JSON.stringify(payload);
    const bytesIn = Buffer.byteLength(before);

    // Remove whitespace, collapse objects
    const after = this.collapseWhitespace(before);
    const bytesOut = Buffer.byteLength(after);

    return {
      data: JSON.parse(after) as T,
      stats: {
        schema_version: "2.0",
        bytes_in: bytesIn,
        bytes_out: bytesOut,
        bytes_saved: bytesIn - bytesOut,
        ratio: bytesOut / bytesIn,
        arrays_processed: this.countArrays(payload),
        objects_processed: this.countObjects(payload),
        recompression_blocked: false,
        pipeline_stage: "caveman_v2.raw",
        timestamp: Date.now(),
        compression_profile: "raw",
        governance_decision: "approved",
      },
    };
  }

  /**
   * SEMANTIC mode (text-aware)
   */
  private semanticCompress<T>(payload: T, opts: CavemanOptionsV2): CavemanResultV2<T> {
    const before = JSON.stringify(payload);
    const bytesIn = Buffer.byteLength(before);

    // Extract semantic tokens, collapse verbose text
    let compressed = before;

    // Simple patterns (expand in real implementation):
    compressed = compressed
      .replace(/\b(error|exception|critical|fail)\b/gi, (m) => m.charAt(0))  // e, e, c, f
      .replace(/\b(warn|warning)\b/gi, "w")
      .replace(/\b(info|information)\b/gi, "i")
      .replace(/\b(debug|debugging)\b/gi, "d")
      .replace(/\b(success|successfully)\b/gi, "ok")
      .replace(/\s+/g, " ")  // collapse multiple spaces
      .trim();

    const bytesOut = Buffer.byteLength(compressed);

    return {
      data: JSON.parse(compressed) as T,
      stats: {
        schema_version: "2.0",
        bytes_in: bytesIn,
        bytes_out: bytesOut,
        bytes_saved: bytesIn - bytesOut,
        ratio: bytesOut / bytesIn,
        arrays_processed: this.countArrays(payload),
        objects_processed: this.countObjects(payload),
        recompression_blocked: false,
        pipeline_stage: "caveman_v2.semantic",
        timestamp: Date.now(),
        compression_profile: "semantic",
        governance_decision: "approved",
      },
    };
  }

  /**
   * AST mode (code-aware)
   */
  private astCompress<T>(payload: T, opts: CavemanOptionsV2): CavemanResultV2<T> {
    const before = JSON.stringify(payload);
    const bytesIn = Buffer.byteLength(before);

    // If language hint provided, parse to AST
    const languageHint = opts.languageHint || this.detectLanguage(before);
    let compressed = before;
    let astNodesProcessed = 0;

    if (languageHint === "javascript" || languageHint === "typescript") {
      // Simple JS compression: remove comments, whitespace, trailing semicolons
      compressed = compressed
        .replace(/\/\*[\s\S]*?\*\//g, "")       // /* */ comments
        .replace(/\/\/.*/g, "")                // // comments
        .replace(/\s+/g, " ")                  // collapse spaces
        .replace(/;\s*$/gm, "")                // trailing semicolons
        .trim();
      astNodesProcessed = this.countAstNodes(compressed, "javascript");
    } else if (languageHint === "python") {
      // Python compression
      compressed = compressed
        .replace(/#.*/g, "")                   // # comments
        .replace(/\n\s+/g, "\n")              // dedent
        .trim();
      astNodesProcessed = this.countAstNodes(compressed, "python");
    } else if (languageHint === "json") {
      // JSON: just remove whitespace (already handled above)
      astNodesProcessed = this.countObjects(payload);
    }

    const bytesOut = Buffer.byteLength(compressed);

    return {
      data: JSON.parse(compressed) as T,
      stats: {
        schema_version: "2.0",
        bytes_in: bytesIn,
        bytes_out: bytesOut,
        bytes_saved: bytesIn - bytesOut,
        ratio: bytesOut / bytesIn,
        arrays_processed: this.countArrays(payload),
        objects_processed: this.countObjects(payload),
        recompression_blocked: false,
        pipeline_stage: "caveman_v2.ast",
        timestamp: Date.now(),
        compression_profile: "ast",
        ast_nodes_processed: astNodesProcessed,
        languages_detected: [languageHint],
        governance_decision: "approved",
      },
    };
  }

  /**
   * DIFF mode (delta-based)
   */
  private diffCompress<T>(payload: T, opts: CavemanOptionsV2): CavemanResultV2<T> {
    const before = JSON.stringify(payload);
    const bytesIn = Buffer.byteLength(before);

    let compressed = before;
    let diffBytesIn = bytesIn;
    let diffBytesOut = bytesIn;

    if (opts.baselineHash) {
      // Compute delta
      const delta = this.computeDelta(payload, opts.baselineHash);
      compressed = JSON.stringify({
        bh: opts.baselineHash,
        d: delta,
      });
      diffBytesIn = bytesIn;
      diffBytesOut = Buffer.byteLength(compressed);
    }

    return {
      data: JSON.parse(compressed) as T,
      stats: {
        schema_version: "2.0",
        bytes_in: bytesIn,
        bytes_out: Buffer.byteLength(compressed),
        bytes_saved: bytesIn - Buffer.byteLength(compressed),
        ratio: Buffer.byteLength(compressed) / bytesIn,
        arrays_processed: this.countArrays(payload),
        objects_processed: this.countObjects(payload),
        recompression_blocked: false,
        pipeline_stage: "caveman_v2.diff",
        timestamp: Date.now(),
        compression_profile: "diff",
        diff_bytes_in: diffBytesIn,
        diff_bytes_out: diffBytesOut,
        diff_ratio: diffBytesOut / diffBytesIn,
        governance_decision: "approved",
      },
    };
  }

  // Helper methods
  private countArrays<T>(obj: T): number {
    if (!obj || typeof obj !== "object") return 0;
    let count = Array.isArray(obj) ? 1 : 0;
    for (const key in obj) {
      if (Array.isArray((obj as any)[key])) count++;
    }
    return count;
  }

  private countObjects<T>(obj: T): number {
    if (!obj || typeof obj !== "object") return 0;
    let count = Array.isArray(obj) ? 0 : 1;
    for (const key in obj) {
      if (typeof (obj as any)[key] === "object") count += this.countObjects((obj as any)[key]);
    }
    return count;
  }

  private detectLanguage(text: string): string {
    if (text.includes("function ") || text.includes("const ") || text.includes("=>")) return "javascript";
    if (text.includes("def ") || text.includes("import ")) return "python";
    if (text.startsWith("{") || text.startsWith("[")) return "json";
    return "unknown";
  }

  private countAstNodes(code: string, language: string): number {
    // Simplified: count patterns
    let count = 0;
    if (language === "javascript") {
      count = (code.match(/function\s+\w+|const\s+\w+|let\s+\w+/g) || []).length;
    } else if (language === "python") {
      count = (code.match(/def\s+\w+|class\s+\w+|import\s+/g) || []).length;
    }
    return count;
  }

  private computeDelta(payload: unknown, baselineHash: string): Record<string, unknown> {
    // Simplified: return all keys that differ
    // In production: actual diff algorithm
    return {};
  }

  private collapseWhitespace(json: string): string {
    return json.replace(/\s+/g, " ").trim();
  }

  private buildStats(
    mode: CavemanModeV2,
    decision: string
  ): CavemanStatsV2 {
    return {
      schema_version: "2.0",
      bytes_in: 0,
      bytes_out: 0,
      bytes_saved: 0,
      ratio: 1,
      arrays_processed: 0,
      objects_processed: 0,
      recompression_blocked: decision === "blocked",
      pipeline_stage: `caveman_v2.${mode}`,
      timestamp: Date.now(),
      compression_profile: mode,
      governance_decision: decision,
    };
  }
}
```

---

## Governance Integration

**Caveman compression modes are governed:**

| Mode | Default | Allowed contexts | Governance |
|------|---------|------------------|-----------|
| raw | ✅ | all paths | always allowed |
| semantic | ⏳ | logs, chat, narrative | opt-in, non-critical only |
| ast | ✅ | code, tool outputs | allowed if language detected |
| diff | ✅ | CIC state, TorqueQuery | preferred for internal state |

**Governance rules:**
- Tool policy can restrict modes per tool
- Agent can override via proposal to EvolutionEngine
- Budget enforcement per mode (daily limits)
- Rate limiting if budget exhausted

---

## Observability

**Metrics:**
- `caveman.compression_ratio` (gauge, per mode)
- `caveman.bytes_saved_total` (counter)
- `caveman.mode_usage_total` (counter, per mode)
- `caveman.budget_exhaustion` (counter)
- `caveman.governance_blocks` (counter)

**Logs:**
- `caveman.compression_complete` (info)
- `caveman.compression_blocked` (warn)
- `caveman.budget_exhausted` (warn)
- `caveman.governance_denied` (warn)

---

## Backwards Compatibility

✅ v1 payloads remain readable  
✅ RAW mode is v1 behavior  
✅ Decompression always possible (stats preserved)

---

## Testing

**Unit tests:**
- `rawCompress()` — v1 behavior preserved
- `semanticCompress()` — text patterns normalized
- `astCompress()` — structure preserved
- `diffCompress()` — deltas accurate
- Governance integration
- Budget enforcement

**Integration tests:**
- End-to-end compression → decompression
- Mode switching via EvolutionEngine
- Governance policy enforcement
- Budget enforcement and rate limiting

**Performance tests:**
- Compression latency < 10ms
- Throughput > 1,000 payloads/sec
- Memory usage < 100MB

---

## Status

✅ Specification locked  
⏳ Implementation: Phase 2.0  
⏳ Testing: Phase 2.0  

---

**Created:** 2026-06-08  
**Target implementation:** 2026-07-15
