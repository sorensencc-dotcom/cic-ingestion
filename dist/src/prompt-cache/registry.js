/**
 * Cache Registry — SQLite-backed store for prompt cache metadata
 * Tracks documents eligible for caching, hit/miss rates, cost savings
 */
import * as fs from 'fs';
import * as path from 'path';
/**
 * In-memory cache registry (production: replace with SQLite)
 * Simpler for Week 1 MVP; can migrate to SQLite in Week 2
 */
export class CacheRegistry {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.docs = new Map();
        this.metrics = new Map();
        this.accessLog = [];
        if (dbPath) {
            this.loadFromDisk();
        }
    }
    registerDoc(docId, contentHash, lengthTokens) {
        // Anthropic minimum for cache insertion is ~1024 tokens
        const cacheEligible = lengthTokens >= 1024;
        if (!this.docs.has(contentHash)) {
            this.docs.set(contentHash, {
                contentHash,
                docId,
                lengthTokens,
                cacheEligible,
                firstRegisteredAt: new Date().toISOString(),
            });
            this.metrics.set(contentHash, {
                cacheHits: 0,
                cacheMisses: 0,
                totalCacheReadTokens: 0,
                totalInputTokens: 0,
            });
        }
        return cacheEligible;
    }
    isRegistered(contentHash) {
        const doc = this.docs.get(contentHash);
        return doc ? doc.cacheEligible : false;
    }
    logAccess(docId, contentHash, cacheHit, cacheReadTokens, inputTokens) {
        const eventType = cacheHit ? 'cache_hit' : 'cache_miss';
        // Log event
        this.accessLog.push({
            contentHash,
            docId,
            eventType,
            cacheHit,
            cacheReadTokens,
            inputTokens,
            timestamp: new Date().toISOString(),
        });
        // Update metrics
        const metric = this.metrics.get(contentHash);
        if (metric) {
            if (cacheHit) {
                metric.cacheHits += 1;
                metric.totalCacheReadTokens += cacheReadTokens;
            }
            else {
                metric.cacheMisses += 1;
                metric.totalInputTokens += inputTokens;
            }
        }
        // Update last accessed
        const doc = this.docs.get(contentHash);
        if (doc) {
            doc.lastAccessedAt = new Date().toISOString();
        }
        // Persist if dbPath set
        if (this.dbPath) {
            this.saveToDisk();
        }
    }
    getMetrics(contentHash) {
        const metric = this.metrics.get(contentHash);
        if (!metric)
            return null;
        const totalRequests = metric.cacheHits + metric.cacheMisses;
        const hitRate = totalRequests > 0 ? (metric.cacheHits / totalRequests) * 100 : 0;
        return {
            cache_hits: metric.cacheHits,
            cache_misses: metric.cacheMisses,
            hit_rate_percent: hitRate,
            total_cache_read_tokens: metric.totalCacheReadTokens,
            total_input_tokens: metric.totalInputTokens,
        };
    }
    summary() {
        const eligibleDocs = Array.from(this.docs.values()).filter((d) => d.cacheEligible).length;
        let totalHits = 0;
        let totalMisses = 0;
        let totalReadTokens = 0;
        for (const metric of this.metrics.values()) {
            totalHits += metric.cacheHits;
            totalMisses += metric.cacheMisses;
            totalReadTokens += metric.totalCacheReadTokens;
        }
        const overallHitRate = totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0;
        return {
            eligible_docs: eligibleDocs,
            total_cache_hits: totalHits,
            total_cache_misses: totalMisses,
            overall_hit_rate_percent: overallHitRate,
            total_cache_read_tokens_saved: totalReadTokens,
        };
    }
    saveToDisk() {
        if (!this.dbPath)
            return;
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const data = {
            docs: Array.from(this.docs.entries()),
            metrics: Array.from(this.metrics.entries()),
            accessLog: this.accessLog,
        };
        fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    }
    loadFromDisk() {
        if (!this.dbPath || !fs.existsSync(this.dbPath))
            return;
        try {
            const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
            this.docs = new Map(data.docs);
            this.metrics = new Map(data.metrics);
            this.accessLog = data.accessLog || [];
        }
        catch (err) {
            console.warn(`Failed to load cache registry from ${this.dbPath}:`, err);
        }
    }
    clear() {
        this.docs.clear();
        this.metrics.clear();
        this.accessLog = [];
    }
}
//# sourceMappingURL=registry.js.map