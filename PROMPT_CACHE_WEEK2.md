# CIC Prompt Cache Router — Week 2 Specification

**Status:** Specification locked  
**Duration:** Days 8–14 (7 days)  
**Baseline:** Week 1 MVP complete, all tests passing, AutonomyService integrated  

---

## Overview

Week 2 expands Week 1 MVP with persistence, batch operations, observability integration, and CLI tooling. All features built on proven Week 1 foundation.

### Success Criteria (End of Week 2)

- [x] SQLite backend fully operational (registry persists across restarts) — Phase 2.1 complete
- [x] Batch document registration working (50+ docs in single call) — Phase 2.2 complete
- [x] Prometheus `/metrics` endpoint exposing cache metrics — Phase 2.3 complete (22/22 tests)
- [ ] 3 CLI commands operational (`cic cache status|clear|metrics`) — Phase 2.4 pending
- [ ] Configuration system working (TTL, model, registry path)
- [x] All tests passing (existing 32 + new 30+) — 44 new tests across 2.1–2.3 ✅
- [x] Zero breaking changes to Week 1 APIs — verified
- [ ] Documentation updated (README, CLI guide) — in progress

---

## Phase 1: SQLite Persistence (Days 8–9)

### Objective

Replace in-memory CacheRegistry with SQLite backend while maintaining API compatibility.

### Files to Create/Modify

**New:**
- `src/prompt-cache/persistence/SQLiteRegistry.ts` (300 lines)
- `src/prompt-cache/persistence/schema.sql` (migrations)
- `src/prompt-cache/__tests__/sqlite.test.ts` (15 tests)

**Modify:**
- `src/prompt-cache/registry.ts` — add persistence layer abstraction

### Implementation Details

#### SQLiteRegistry Class

```typescript
export class SQLiteRegistry {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string = './cache-registry.db');

  // Implement same interface as CacheRegistry
  async registerDoc(docId: string, hash: string, tokens: number): Promise<void>
  async logAccess(docId: string, hash: string, hit: boolean, ...): Promise<void>
  async getMetrics(hash: string): Promise<CacheMetrics | null>
  async summary(): Promise<CacheSummary>
  async clear(): Promise<void>

  // New methods
  async migrate(): Promise<void>  // Run schema migrations
  async close(): Promise<void>    // Close DB connection
}
```

#### Database Schema

```sql
CREATE TABLE IF NOT EXISTS cache_documents (
  id TEXT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  tokens_estimated INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at TIMESTAMP,
  INDEX idx_hash (hash)
);

CREATE TABLE IF NOT EXISTS cache_accesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  was_hit BOOLEAN NOT NULL,
  cache_read_tokens INTEGER,
  input_tokens INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(doc_id) REFERENCES cache_documents(id),
  INDEX idx_doc_id (doc_id),
  INDEX idx_timestamp (timestamp)
);

CREATE TABLE IF NOT EXISTS cache_metrics (
  hash TEXT PRIMARY KEY,
  total_hits INTEGER DEFAULT 0,
  total_misses INTEGER DEFAULT 0,
  total_tokens_saved INTEGER DEFAULT 0,
  cost_with_cache REAL DEFAULT 0,
  cost_without_cache REAL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Acceptance Criteria

- [ ] SQLiteRegistry constructor accepts `dbPath` parameter (defaults to `./cache-registry.db`)
- [ ] Schema auto-migrates on first run
- [ ] All CacheRegistry methods work identically (sync interface → async)
- [ ] DB connection properly closed on shutdown
- [ ] Concurrent access handled (WAL mode enabled)
- [ ] 15 tests passing (roundtrip, schema, concurrent access)
- [ ] Zero data loss on restart
- [ ] Performance: queries < 50ms (5K documents)

#### Integration

```typescript
// In CICPromptCacheRouter constructor
const registry = process.env.USE_SQLITE === 'true'
  ? new SQLiteRegistry(process.env.PROMPT_CACHE_DB_PATH)
  : new CacheRegistry();
```

---

## Phase 2: Batch Document Operations (Days 9–10)

### Objective

Enable efficient registration and analysis of multiple documents in single call.

### Files to Create/Modify

**New:**
- `src/prompt-cache/batch.ts` (200 lines)
- `src/prompt-cache/__tests__/batch.test.ts` (12 tests)

**Modify:**
- `src/prompt-cache/router.ts` — add batch methods
- `src/autonomy/AutonomyPromptCacheAdapter.ts` — add batch wrapper

### Implementation Details

#### Batch Operations Interface

```typescript
export interface BatchDocument {
  docId: string;
  docText: string;
}

export interface BatchAnalysisRequest {
  documents: BatchDocument[];
  task: AnalysisTask;
  parallelism?: number; // Default: 3
}

export interface BatchAnalysisResult {
  results: Array<{
    docId: string;
    analysis: string;
    cacheMetadata: {
      cacheHit: boolean;
      costSavings: number;
    };
  }>;
  summary: {
    totalDocs: number;
    cacheHits: number;
    totalSavings: number;
  };
}

export class CICPromptCacheRouter {
  // Existing methods...

  async generateBatchWithCache(req: BatchAnalysisRequest): Promise<BatchAnalysisResult> {
    // Implement with controlled parallelism (respect API rate limits)
  }
}
```

#### Batch Registry Updates

```typescript
export class CacheRegistry {
  // Existing methods...

  async registerDocuments(docs: Array<{docId: string; hash: string; tokens: number}>): Promise<void> {
    // Bulk insert
  }

  async logBatchAccesses(accesses: Array<{docId: string; hit: boolean; ...}>): Promise<void> {
    // Bulk insert
  }
}
```

#### Acceptance Criteria

- [ ] Batch method accepts 2–100 documents per request
- [ ] Parallelism controlled (max 3 concurrent API calls by default)
- [ ] Registry bulk-inserts (single transaction, < 100ms for 50 docs)
- [ ] API rate limits respected (no burst > 3 req/sec)
- [ ] Each document analyzed independently
- [ ] Results aggregated with per-doc cost tracking
- [ ] 12 tests passing (50-doc batch, rate limiting, error handling)

#### Integration

```typescript
const adapter = new AutonomyPromptCacheAdapter();

const result = await adapter.analyzeDocumentBatchWithCache({
  documents: [
    { docId: 'batch_001', docText: archivalText1 },
    { docId: 'batch_002', docText: archivalText2 },
    // ... up to 100 docs
  ],
  task: 'extract_findings',
  parallelism: 5,
});

console.log(`Processed ${result.summary.totalDocs} docs`);
console.log(`Cache hits: ${result.summary.cacheHits}`);
console.log(`Total savings: $${result.summary.totalSavings}`);
```

---

## Phase 3: Prometheus Metrics (Days 10–11) — ✅ COMPLETE

**Status:** DELIVERED (commit 3d4bd4b)  
**Tests:** 22/22 passing (13 unit + 9 integration) in Docker  
**Date:** 2026-06-14

### Objective

Expose cache metrics in Prometheus format for monitoring & alerting.

### Files Created/Modified

**New:**

- `src/prompt-cache/metrics/CacheMetricsExporter.ts` (131 lines)
- `src/prompt-cache/metrics/CacheMetricsExporter.test.ts` (13 tests)
- `src/prompt-cache/metrics/index.ts` (barrel export)
- `src/autonomy/routes/__tests__/cache.test.ts` (9 integration tests)

**Modify:**

- `src/autonomy/routes/cache.ts` — added Prometheus endpoint
- `src/autonomy/AutonomyAPIServer.ts` — documented endpoint

### Implementation Details

#### Prometheus Metrics Class

```typescript
export class CacheMetricsExporter {
  private registry: CacheRegistry;

  constructor(registry: CacheRegistry);

  // Return Prometheus text format
  toPrometheus(): string {
    return `
# HELP cache_eligible_documents Number of documents eligible for caching (≥1024 tokens)
# TYPE cache_eligible_documents gauge
cache_eligible_documents ${this.getEligibleDocCount()}

# HELP cache_hit_rate_percent Overall cache hit rate percentage
# TYPE cache_hit_rate_percent gauge
cache_hit_rate_percent ${this.getHitRatePercent()}

# HELP cache_total_hits Total number of cache hits
# TYPE cache_total_hits counter
cache_total_hits ${this.getTotalHits()}

# HELP cache_total_misses Total number of cache misses
# TYPE cache_total_misses counter
cache_total_misses ${this.getTotalMisses()}

# HELP cache_read_input_tokens_total Total cache-read tokens (read cost = tokens / 1M * $0.30)
# TYPE cache_read_input_tokens_total counter
cache_read_input_tokens_total ${this.getTotalCacheReadTokens()}

# HELP cache_estimated_weekly_savings_usd Estimated weekly cost savings
# TYPE cache_estimated_weekly_savings_usd gauge
cache_estimated_weekly_savings_usd ${this.estimateWeeklySavings()}

# HELP cache_api_request_duration_ms API request latency (with cache)
# TYPE cache_api_request_duration_ms histogram
cache_api_request_duration_ms_bucket{le="100"} ...
cache_api_request_duration_ms_bucket{le="500"} ...
cache_api_request_duration_ms_bucket{le="1000"} ...
cache_api_request_duration_ms_sum ...
cache_api_request_duration_ms_count ...
    `;
  }
}
```

#### New Express Route

```typescript
// In routes/cache.ts
router.get('/cache/metrics/prometheus', (_req: Request, res: Response) => {
  const exporter = new CacheMetricsExporter(adapter.getRegistry());
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(exporter.toPrometheus());
});

// Existing /autonomy/cache/metrics continues (JSON format)
```

#### Acceptance Criteria

- [x] `/autonomy/cache/metrics/prometheus` endpoint returns valid Prometheus format — ✅
- [x] All metrics expose in text/plain with correct syntax — ✅ (5 metrics: documents, hits, misses, hit_ratio, tokens_saved)
- [x] Metrics update in real-time (hit rate recalculated on each request) — ✅
- [x] 22 tests passing (13 unit + 9 integration) — ✅ all passing in Docker
- [x] Valid Prometheus v0.0.4 format with HELP/TYPE headers — ✅

#### Grafana Integration (Optional, Week 2 Phase 5)

- PromQL examples for common queries
- Sample dashboard JSON for Grafana import

---

## Phase 4: CLI Commands (Days 11–12)

### Objective

Expose cache operations via CLI (cic-cli-cache.ts).

### Files to Create/Modify

**New:**
- `src/cli/cic-cli-cache.ts` (400 lines)
- `src/cli/__tests__/cli-cache.test.ts` (10 tests)

**Modify:**
- `cic-cli.ts` — register new command group

### Implementation Details

#### CLI Interface

```bash
# Show cache status
cic cache status
# Output:
#   Eligible documents: 15
#   Cache hit rate: 72.5%
#   Total cache hits: 145
#   Total cache misses: 55
#   Tokens saved: 2,345,678
#   Estimated weekly savings: $2.34

# Clear entire cache registry
cic cache clear
# Output: ✅ Cleared 15 documents from registry

# Export metrics (JSON)
cic cache metrics --format=json
# Output: { eligible_documents: 15, hit_rate_percent: 72.5, ... }

# Export metrics (Prometheus)
cic cache metrics --format=prometheus
# Output: [Prometheus text format]

# Real-time monitoring (continuous)
cic cache watch --interval=5
# Polls status every 5 seconds, updates in-place
```

#### CLI Implementation

```typescript
// cic-cli-cache.ts
import { program } from 'commander';
import { CICPromptCacheRouter } from '../prompt-cache/router';

const cacheCommand = new program.Command('cache')
  .description('Cache management and monitoring');

cacheCommand
  .command('status')
  .description('Show cache status')
  .action(async () => {
    const router = new CICPromptCacheRouter();
    const summary = router.getSummary();
    console.log(`Eligible documents: ${summary.eligible_docs}`);
    console.log(`Cache hit rate: ${summary.overall_hit_rate_percent.toFixed(1)}%`);
    // ...
  });

cacheCommand
  .command('clear')
  .description('Clear entire cache registry')
  .option('-f, --force', 'Skip confirmation')
  .action(async (opts) => {
    if (!opts.force) {
      // Prompt for confirmation
    }
    const router = new CICPromptCacheRouter();
    router.clearRegistry();
    console.log('✅ Cache cleared');
  });

cacheCommand
  .command('metrics')
  .description('Export cache metrics')
  .option('--format <format>', 'Output format: json|prometheus', 'json')
  .action(async (opts) => {
    const router = new CICPromptCacheRouter();
    if (opts.format === 'prometheus') {
      const exporter = new CacheMetricsExporter(router);
      console.log(exporter.toPrometheus());
    } else {
      console.log(JSON.stringify(router.getSummary(), null, 2));
    }
  });

cacheCommand
  .command('watch')
  .description('Real-time cache monitoring')
  .option('--interval <ms>', 'Poll interval', '5000')
  .action(async (opts) => {
    const router = new CICPromptCacheRouter();
    setInterval(() => {
      // Clear screen, show status
      console.clear();
      console.log(`[${new Date().toISOString()}] Cache Status`);
      const summary = router.getSummary();
      console.log(`Hit rate: ${summary.overall_hit_rate_percent.toFixed(1)}%`);
    }, parseInt(opts.interval));
  });

export default cacheCommand;
```

#### Acceptance Criteria

- [ ] `cic cache status` returns current metrics
- [ ] `cic cache clear` removes all registry entries (with confirmation)
- [ ] `cic cache metrics --format=json` exports JSON
- [ ] `cic cache metrics --format=prometheus` exports Prometheus format
- [ ] `cic cache watch` continuously polls (updates in-place)
- [ ] All commands error-handle gracefully (missing DB, etc.)
- [ ] 10 tests passing (mock router, output format validation)
- [ ] Help text complete (`cic cache --help`)

---

## Phase 5: Configuration System (Days 12–14)

### Objective

Allow runtime configuration of TTL, model, registry location, and other parameters.

### Files to Create/Modify

**New:**
- `src/prompt-cache/config.ts` (150 lines)
- `src/prompt-cache/__tests__/config.test.ts` (8 tests)

**Modify:**
- `src/prompt-cache/router.ts` — use config
- `.env.example` — document new variables

### Implementation Details

#### Configuration Interface

```typescript
export interface PromptCacheConfig {
  // Registry
  registryDbPath?: string;        // Default: ./cache-registry.db
  useMemoryRegistry?: boolean;    // Default: false (use SQLite)
  
  // Caching behavior
  ttlSeconds?: number;            // Default: 300 (5 minutes, Anthropic limit)
  minCacheableTokens?: number;    // Default: 1024 (Anthropic minimum)
  
  // API
  model?: string;                 // Default: claude-3-5-sonnet-20241022
  maxRetries?: number;            // Default: 3
  requestTimeoutMs?: number;      // Default: 30000
  
  // Batch
  maxBatchSize?: number;          // Default: 50
  maxParallelism?: number;        // Default: 3
  
  // Pricing (for cost calculation)
  pricingInputPerMillion?: number;      // Default: 3.0
  pricingCacheReadPerMillion?: number;  // Default: 0.30
  pricingOutputPerMillion?: number;     // Default: 15.0
  
  // Observability
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // Default: info
  metricsPrefix?: string;         // Default: cache_
}

export class PromptCacheConfigManager {
  static fromEnv(): PromptCacheConfig {
    return {
      registryDbPath: process.env.PROMPT_CACHE_DB_PATH || './cache-registry.db',
      useMemoryRegistry: process.env.PROMPT_CACHE_USE_MEMORY === 'true',
      ttlSeconds: parseInt(process.env.PROMPT_CACHE_TTL_SECONDS || '300'),
      model: process.env.PROMPT_CACHE_MODEL || 'claude-3-5-sonnet-20241022',
      maxBatchSize: parseInt(process.env.PROMPT_CACHE_MAX_BATCH || '50'),
      logLevel: (process.env.PROMPT_CACHE_LOG_LEVEL || 'info') as any,
    };
  }

  static fromFile(path: string): PromptCacheConfig {
    // Load from JSON file
  }
}
```

#### Environment Variables (.env.example)

```bash
# Prompt Cache Configuration

# Registry backend (SQLite path or memory)
PROMPT_CACHE_DB_PATH=./cache-registry.db
PROMPT_CACHE_USE_MEMORY=false

# Caching behavior
PROMPT_CACHE_TTL_SECONDS=300
PROMPT_CACHE_MIN_CACHEABLE_TOKENS=1024

# API configuration
PROMPT_CACHE_MODEL=claude-3-5-sonnet-20241022
PROMPT_CACHE_MAX_RETRIES=3
PROMPT_CACHE_REQUEST_TIMEOUT_MS=30000

# Batch operations
PROMPT_CACHE_MAX_BATCH_SIZE=50
PROMPT_CACHE_MAX_PARALLELISM=3

# Pricing (for cost tracking)
PROMPT_CACHE_PRICING_INPUT_PER_MILLION=3.0
PROMPT_CACHE_PRICING_CACHE_READ_PER_MILLION=0.30
PROMPT_CACHE_PRICING_OUTPUT_PER_MILLION=15.0

# Observability
PROMPT_CACHE_LOG_LEVEL=info
PROMPT_CACHE_METRICS_PREFIX=cache_
```

#### Router Integration

```typescript
export class CICPromptCacheRouter {
  private config: PromptCacheConfig;
  private model: string;
  private registry: CacheRegistry | SQLiteRegistry;

  constructor(config?: PromptCacheConfig) {
    this.config = config || PromptCacheConfigManager.fromEnv();
    this.model = this.config.model || 'claude-3-5-sonnet-20241022';
    
    if (this.config.useMemoryRegistry) {
      this.registry = new CacheRegistry();
    } else {
      this.registry = new SQLiteRegistry(this.config.registryDbPath);
    }
  }

  async generateWithCache(opts: GenerateOptions): Promise<GenerateResult> {
    // Use this.config.model instead of hardcoded
    // Use this.config for pricing calculations
    // Respect TTL, batch size, etc.
  }
}
```

#### Acceptance Criteria

- [ ] Config loads from environment variables
- [ ] Config loads from JSON file (optional)
- [ ] All parameters have sensible defaults
- [ ] Router uses config (no hardcoded values)
- [ ] Model can be switched at runtime
- [ ] TTL configurable (though Anthropic limit is 5 min)
- [ ] Registry location configurable
- [ ] Pricing parameters adjustable (for future API changes)
- [ ] 8 tests passing (env parsing, file loading, defaults)
- [ ] `.env.example` complete and documented

---

## Integration Checklist

### AutonomyService Updates
- [ ] `analyzeArchivalBatch()` accepts batch documents
- [ ] Delegates to AutonomyPromptCacheAdapter batch method
- [ ] Returns aggregated results with cost summary

### AutonomyAPIServer Updates
- [ ] `/autonomy/cache/metrics` (existing, unchanged)
- [ ] `/autonomy/cache/metrics/prometheus` (new)
- [ ] CLI commands registered in main CLI entry

### Documentation Updates
- [ ] `README.md` updated (batch API examples)
- [ ] `PROMPT_CACHE_WEEK2.md` → `PROMPT_CACHE_COMPLETE.md` after merge
- [ ] CLI guide (examples, troubleshooting)
- [ ] Prometheus integration guide (Grafana setup)

---

## Test Coverage Target

**Existing (Week 1):** 32 tests  
**New (Week 2):** 35+ tests

| Phase | Tests | File |
|-------|-------|------|
| SQLite | 15 | sqlite.test.ts |
| Batch | 12 | batch.test.ts |
| Metrics | 8 | metrics.test.ts |
| CLI | 10 | cli-cache.test.ts |
| Config | 8 | config.test.ts |
| **Total** | **53+** | |

---

## Timeline

| Phase | Days | Start | End | Status |
|-------|------|-------|-----|--------|
| 1: SQLite | 2 | Day 8 | Day 9 | 🔲 Ready |
| 2: Batch | 2 | Day 9 | Day 10 | 🔲 Ready |
| 3: Prometheus | 2 | Day 10 | Day 11 | 🔲 Ready |
| 4: CLI | 2 | Day 11 | Day 12 | 🔲 Ready |
| 5: Config | 3 | Day 12 | Day 14 | 🔲 Ready |

---

## Success Criteria (Final)

✅ All 5 phases complete  
✅ 50+ tests passing  
✅ SQLite persists across restarts  
✅ Batch operations handle 50+ docs  
✅ Prometheus metrics valid + scrapeable  
✅ CLI commands work end-to-end  
✅ Configuration system flexible  
✅ Zero breaking changes  
✅ Documentation complete  
✅ Ready for production deployment  

---

## References

- **Week 1 MVP:** `PROMPT_CACHE_WEEK1.md` (completed)
- **Implementation Summary:** `PROMPT_CACHE_IMPLEMENTATION_SUMMARY.md`
- **Usage Guide:** `src/prompt-cache/README.md`
- **Prometheus Docs:** https://prometheus.io/docs/instrumenting/exposition_formats/
- **SQLite Docs:** https://www.sqlite.org/docs.html
- **CLI Best Practices:** https://www.npmjs.com/package/commander

---

**Specification locked:** 2026-06-14  
**Ready for implementation:** Week 2 (Days 8–14)
