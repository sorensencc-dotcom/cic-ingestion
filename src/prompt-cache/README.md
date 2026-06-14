# CIC Prompt Cache Router

Cloud prompt caching for CIC autonomy agents. Reduces token costs and improves latency for repeated document analysis.

## Overview

Anthropic's prompt caching feature allows documents (≥1024 tokens) to be cached and reused across requests, charging only 10% of the input token cost for cache hits. This module integrates caching directly into CIC's autonomy layer.

## Features

- **Deterministic Canonicalization** — Normalizes text to ensure identical documents produce identical hashes
- **Automatic Registry** — Tracks documents, hit rates, and cost savings
- **Token Estimation** — Quick estimates for cache eligibility
- **Cost Tracking** — Measures real savings vs. non-cached baseline
- **Autonomy Integration** — Task-specific prompts for document analysis

## Usage

### Basic: Direct Router

```typescript
import { CICPromptCacheRouter } from './prompt-cache/router';

const router = new CICPromptCacheRouter();

const result = await router.generateWithCache({
  docId: 'kroll_batch_001',
  docText: longArchivalText,
  userPrompt: 'Extract key findings from this batch.',
  maxTokens: 2000,
});

console.log('Cost savings:', result.metadata.costSavings);
console.log('Cache hit:', result.metadata.cacheHit);
```

### Recommended: Autonomy Adapter

```typescript
import { AutonomyPromptCacheAdapter } from './autonomy/AutonomyPromptCacheAdapter';

const adapter = new AutonomyPromptCacheAdapter();

const result = await adapter.analyzeDocumentWithCache({
  docId: 'kroll_batch_001',
  docText: archivalContent,
  task: 'extract_findings',
  context: 'Archival research batch', // Optional
});

console.log('Analysis:', result.analysis);
console.log('Cache hit:', result.cacheMetadata.cacheHit);
console.log('Cost savings:', result.cacheMetadata.costSavings);
```

### Tasks Available

```typescript
type AnalysisTask =
  | 'extract_findings'      // Pull out key conclusions
  | 'identify_gaps'         // Find missing information
  | 'propose_actions'       // Recommend next steps
  | 'summarize_content'     // Create brief summary
  | 'detect_patterns';      // Find recurring themes
```

## Architecture

### Canonicalize (`canonicalize.ts`)

Normalizes text to ensure deterministic hashing:

- NFKC unicode normalization
- Whitespace collapsing
- Control character removal
- SHA-256 hashing

### Registry (`registry.ts`)

In-memory store (Week 1 MVP) for cache metadata:

- Document eligibility tracking
- Hit/miss counters
- Token usage metrics
- Serializable to disk

### Router (`router.ts`)

Main API endpoint:

- Wraps Anthropic SDK
- Applies cache_control headers
- Tracks costs and savings
- Logs to registry

### Autonomy Adapter (`AutonomyPromptCacheAdapter.ts`)

Task-oriented wrapper:

- Task-specific prompt templates
- Cost reporting
- Cache status logging

## Integration Points

### In AutonomyService

```typescript
import { AutonomyPromptCacheAdapter } from './AutonomyPromptCacheAdapter';

class AutonomyService {
  private cacheAdapter = new AutonomyPromptCacheAdapter();

  async analyzeArchival(docId: string, content: string) {
    const result = await this.cacheAdapter.analyzeDocumentWithCache({
      docId,
      docText: content,
      task: 'extract_findings',
    });
    return result.analysis;
  }
}
```

### In AutonomyAPIServer

```typescript
import { createCacheRouter } from './routes/cache';

const cacheAdapter = new AutonomyPromptCacheAdapter();
const cacheRouter = createCacheRouter(cacheAdapter);

server.use('/autonomy', cacheRouter);
```

Endpoints:
- `GET /autonomy/cache/metrics` — JSON statistics
- `GET /autonomy/cache/status` — Human-readable status

## Configuration

Set via environment variables:

```bash
ANTHROPIC_API_KEY=sk-ant-xxx          # Required
PROMPT_CACHE_DB_PATH=/data/cache.db   # Optional (Week 2)
```

## Testing

```bash
npm test -- prompt-cache

# Full integration
npm test -- prompt-cache --integration
```

## Week 1 Metrics

Expected output after 24h of operation:

```json
{
  "eligible_documents": 5,
  "overall_hit_rate_percent": 72.5,
  "total_cache_hits": 58,
  "total_cache_misses": 22,
  "total_cache_read_tokens_saved": 234567,
  "estimated_weekly_savings": "$2.34"
}
```

## Week 2 Roadmap

- [ ] SQLite backend (replace in-memory registry)
- [ ] Batch document registration
- [ ] Cache expiration policies
- [ ] Observability hooks (Prometheus metrics)
- [ ] CLI commands for cache management

## Costs & Savings

**Anthropic Pricing (Sonnet 3.5 as of 2026):**

- Input tokens: $3.00 / 1M
- Cache read tokens: $0.30 / 1M (90% savings)
- Output tokens: $15.00 / 1M

**Example:** 100K-token document, 75% cache hit rate

```
Without cache:
  100K input × $3.00/M = $0.30 per request

With cache (75% hit):
  75K cache_read × $0.30/M = $0.0225
  25K input × $3.00/M = $0.075
  Total = $0.0975 per request
  Savings: $0.20 per request (67% reduction)
```

## Limitations

- **Minimum size:** Documents < 1024 tokens not cached
- **Format:** Text only (images in Week 2)
- **Latency:** Cache writes add ~100ms first request
- **TTL:** 5 minutes default (configurable in Week 2)

## References

- [Anthropic Prompt Caching Docs](https://docs.anthropic.com/en/docs/build-a-claude-app/caching)
- [CIC Phase 23.7 Memory Layer](../../../docs/cic/phase-23-autonomy-stack.md)
