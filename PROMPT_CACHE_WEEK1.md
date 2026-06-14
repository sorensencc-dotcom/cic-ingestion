# CIC Prompt Cache Router — Week 1 Implementation

**Start:** Today
**End:** +7 days
**Status:** ✅ Code complete, ready for testing & integration

## Deliverables

### Core Modules (DONE)

- [x] `src/prompt-cache/canonicalize.ts` — Text normalization + SHA-256 hashing
- [x] `src/prompt-cache/registry.ts` — In-memory cache metadata store
- [x] `src/prompt-cache/router.ts` — Main Anthropic API wrapper
- [x] `src/autonomy/AutonomyPromptCacheAdapter.ts` — Task-specific wrapper
- [x] `src/autonomy/routes/cache.ts` — API endpoints for metrics

### Tests (DONE)

- [x] `src/prompt-cache/__tests__/canonicalize.test.ts` — Hash consistency
- [x] `src/prompt-cache/__tests__/registry.test.ts` — Metrics tracking
- [x] `src/prompt-cache/__tests__/integration.test.ts` — Adapter integration
- [x] `src/prompt-cache/README.md` — Usage guide

### Configuration (DONE)

- [x] Updated `package.json` with `@anthropic-ai/sdk`

## Implementation Checklist

### Phase 1: Build & Test (Days 1–2)

```bash
# Install dependencies
npm install

# Run tests (should all pass)
npm test -- prompt-cache

# Typecheck
npm run typecheck
```

**Tasks:**
- [ ] Verify all imports resolve
- [ ] Confirm no TypeScript errors
- [ ] Run canonicalize tests (normalization consistency)
- [ ] Run registry tests (hit/miss tracking)

### Phase 2: Integration (Days 3–4) ✅

Update AutonomyService to use the cache adapter:

```typescript
// In AutonomyService.ts, near line 81
import { AutonomyPromptCacheAdapter } from './AutonomyPromptCacheAdapter';

export class AutonomyService {
  private cacheAdapter = new AutonomyPromptCacheAdapter();
  
  // Existing methods...
  
  async analyzeArchivalBatch(
    docId: string,
    batchContent: string,
    analysisType: 'findings' | 'gaps' | 'patterns'
  ) {
    const taskMap = {
      findings: 'extract_findings',
      gaps: 'identify_gaps',
      patterns: 'detect_patterns',
    };
    
    return await this.cacheAdapter.analyzeDocumentWithCache({
      docId,
      docText: batchContent,
      task: taskMap[analysisType],
    });
  }
  
  getCacheAdapter(): AutonomyPromptCacheAdapter {
    return this.cacheAdapter;
  }
}
```

**Tasks:**
- [x] Add import for AutonomyPromptCacheAdapter
- [x] Initialize adapter in constructor
- [x] Add `analyzeArchivalBatch` method
- [x] Add getter for cache adapter

### Phase 3: API Endpoint (Days 4–5) ✅

Update AutonomyAPIServer to expose cache metrics:

```typescript
// In AutonomyAPIServer.ts, after line 14
import { createCacheRouter } from './routes/cache';

// In setupRoutes(), add:
const cacheRouter = createCacheRouter(this.service.getCacheAdapter());
this.app.use('/autonomy', cacheRouter);
```

**Tasks:**
- [x] Add cache route import
- [x] Mount cache router in setupRoutes()
- [x] Update API info with cache endpoint docs

### Phase 4: Local Testing (Days 5–6)

Spin up local stack and validate:

```bash
# Build with Docker (use TheFoundry)
make build

# Start server
make compose-up

# Test endpoint in another terminal
curl http://localhost:3000/autonomy/cache/metrics

# Try the router directly (see example below)
npm test -- prompt-cache/integration
```

**Tasks:**
- [ ] Server starts without errors
- [ ] `/metrics` endpoint returns valid JSON
- [ ] Registry tracks documents correctly
- [ ] Hit rate calculation works

### Phase 5: Observability (Days 6–7)

Log cache status during operation:

```typescript
// In AutonomyAPIServer startup
async start() {
  const server = await this.listen();
  this.cacheAdapter.logCacheStatus(); // Initial state
  
  // Log every hour
  setInterval(() => {
    this.cacheAdapter.logCacheStatus();
  }, 3600_000);
  
  return server;
}
```

**Tasks:**
- [ ] Implement periodic logging
- [ ] Verify logs show in console
- [ ] Collect 24h of metrics
- [ ] Report hit rate & savings

## Quick Start (Local Testing)

### Test Canonicalization

```bash
npm test -- canonicalize.test.ts
```

Expected: All 6 tests pass (normalization, hashing, token estimation)

### Test Registry

```bash
npm test -- registry.test.ts
```

Expected: All 8 tests pass (register, log, metrics, summary)

### Test Adapter

```bash
npm test -- integration.test.ts
```

Expected: Adapter initialization and method calls work

## Metrics Collection (Week 1 End)

After 24h of production operation, collect:

```json
{
  "timestamp": "2026-06-14T18:00:00Z",
  "cache_status": {
    "eligible_documents": 5,
    "total_cache_hits": 45,
    "total_cache_misses": 15,
    "overall_hit_rate_percent": 75.0,
    "total_cache_read_tokens_saved": 234567,
    "estimated_weekly_savings": "$2.34"
  },
  "documents_processed": [
    {
      "doc_id": "kroll_batch_001",
      "cache_hits": 12,
      "cache_misses": 3,
      "hit_rate": "80%",
      "tokens_saved": 125000
    }
  ]
}
```

## Troubleshooting

### No API key error
```
Error: ANTHROPIC_API_KEY not set
```
→ Set env var: `export ANTHROPIC_API_KEY=sk-ant-...`

### Type errors in TypeScript
```
error TS2307: Cannot find module '@anthropic-ai/sdk'
```
→ Run `npm install` to pull dependencies

### Registry not persisting
→ Week 1 uses in-memory storage. Week 2 adds SQLite. To test persistence, use `registryDbPath`:

```typescript
const adapter = new AutonomyPromptCacheAdapter('/tmp/cache.db');
```

## Success Criteria

✅ **Week 1 Complete When:**

1. All tests pass (`npm test -- prompt-cache`)
2. TypeScript has zero errors (`npm run typecheck`)
3. Server starts and `/autonomy/cache/metrics` returns valid JSON
4. Router canonicalizes identical documents to same hash
5. Registry tracks ≥3 cache hits in 24h test run
6. Cost savings calculated correctly (formula validated)

## Next Steps (Week 2)

- [ ] Migrate registry to SQLite backend
- [ ] Add batch document registration
- [ ] Implement cache expiration (TTL management)
- [ ] Integrate with Prometheus metrics
- [ ] Add CLI: `cic cache status`, `cic cache clear`

## References

- **Prompt Caching Docs:** https://docs.anthropic.com/en/docs/build-a-claude-app/caching
- **CIC Phase 23.7:** `docs/cic/phase-23-autonomy-stack.md`
- **Anthropic SDK:** https://github.com/anthropics/anthropic-sdk-python

---

**Questions?** Check `src/prompt-cache/README.md` for usage examples.
