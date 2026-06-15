import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
/**
 * SQLite-backed cache registry for prompt caching.
 * Maintains same API as in-memory CacheRegistry but with persistence.
 */
export class SQLiteRegistry {
    constructor(dbPath = './cache-registry.db') {
        // Ensure directory exists
        const dir = dirname(dbPath);
        mkdirSync(dir, { recursive: true });
        // Open with WAL mode for concurrent access
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
    }
    /**
     * Run schema migrations on first access.
     */
    async migrate() {
        try {
            const schemaPath = join(dirname(__filename), 'schema.sql');
            const schema = readFileSync(schemaPath, 'utf-8');
            // Split by ; and execute each statement
            const statements = schema
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);
            for (const stmt of statements) {
                this.db.exec(stmt);
            }
        }
        catch (err) {
            throw new Error(`Failed to migrate schema: ${err.message}`);
        }
    }
    /**
     * Register a document for caching.
     */
    async registerDoc(docId, hash, tokens) {
        try {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cache_documents (id, hash, tokens_estimated, last_accessed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
            stmt.run(docId, hash, tokens);
        }
        catch (err) {
            throw new Error(`Failed to register doc ${docId}: ${err.message}`);
        }
    }
    /**
     * Check if document is registered.
     */
    async isRegistered(docId) {
        try {
            const stmt = this.db.prepare('SELECT id FROM cache_documents WHERE id = ?');
            const row = stmt.get(docId);
            return !!row;
        }
        catch (err) {
            throw new Error(`Failed to check registration: ${err.message}`);
        }
    }
    /**
     * Log cache access (hit or miss).
     */
    async logAccess(docId, hash, hit, cacheReadTokens, inputTokens) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO cache_accesses (doc_id, hash, was_hit, cache_read_tokens, input_tokens)
        VALUES (?, ?, ?, ?, ?)
      `);
            stmt.run(docId, hash, hit ? 1 : 0, cacheReadTokens || 0, inputTokens || 0);
            // Update metrics table
            const updateMetrics = this.db.prepare(`
        INSERT INTO cache_metrics (hash, total_hits, total_misses)
        VALUES (?, ?, ?)
        ON CONFLICT(hash) DO UPDATE SET
          total_hits = total_hits + EXCLUDED.total_hits,
          total_misses = total_misses + EXCLUDED.total_misses,
          last_updated = CURRENT_TIMESTAMP
      `);
            updateMetrics.run(hash, hit ? 1 : 0, hit ? 0 : 1);
        }
        catch (err) {
            throw new Error(`Failed to log access: ${err.message}`);
        }
    }
    /**
     * Get metrics for a specific document hash.
     */
    async getMetrics(hash) {
        try {
            const stmt = this.db.prepare(`
        SELECT * FROM cache_metrics WHERE hash = ?
      `);
            const row = stmt.get(hash);
            if (!row)
                return null;
            return {
                docId: hash,
                hash: row.hash,
                totalHits: row.total_hits,
                totalMisses: row.total_misses,
                totalTokensSaved: row.total_tokens_saved || 0,
                costWithCache: row.cost_with_cache || 0,
                costWithoutCache: row.cost_without_cache || 0,
            };
        }
        catch (err) {
            throw new Error(`Failed to get metrics: ${err.message}`);
        }
    }
    /**
     * Get aggregate cache summary.
     */
    async summary() {
        try {
            // Count eligible documents (>= 1024 tokens)
            const docsStmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM cache_documents WHERE tokens_estimated >= 1024
      `);
            const docsRow = docsStmt.get();
            const eligible_docs = docsRow?.count || 0;
            // Calculate hit rate
            const hitsStmt = this.db.prepare(`
        SELECT
          SUM(CASE WHEN was_hit = 1 THEN 1 ELSE 0 END) as hits,
          COUNT(*) as total
        FROM cache_accesses
      `);
            const hitsRow = hitsStmt.get();
            const total_hits = hitsRow?.hits || 0;
            const total_accesses = hitsRow?.total || 0;
            const overall_hit_rate_percent = total_accesses > 0
                ? (total_hits / total_accesses) * 100
                : 0;
            const total_misses = total_accesses - total_hits;
            // Sum saved tokens
            const tokensStmt = this.db.prepare(`
        SELECT SUM(cache_read_tokens) as saved FROM cache_accesses WHERE was_hit = 1
      `);
            const tokensRow = tokensStmt.get();
            const total_tokens_saved = tokensRow?.saved || 0;
            // Estimate weekly savings ($0.30 per 1M cache-read tokens)
            const estimated_weekly_savings = (total_tokens_saved / 1000000) * 0.30;
            return {
                eligible_docs,
                overall_hit_rate_percent,
                total_hits,
                total_misses,
                total_tokens_saved,
                estimated_weekly_savings,
            };
        }
        catch (err) {
            throw new Error(`Failed to get summary: ${err.message}`);
        }
    }
    /**
     * Clear all cache data.
     */
    async clear() {
        try {
            this.db.prepare('DELETE FROM cache_accesses').run();
            this.db.prepare('DELETE FROM cache_metrics').run();
            this.db.prepare('DELETE FROM cache_documents').run();
        }
        catch (err) {
            throw new Error(`Failed to clear cache: ${err.message}`);
        }
    }
    /**
     * Close database connection.
     */
    async close() {
        try {
            this.db.close();
        }
        catch (err) {
            throw new Error(`Failed to close database: ${err.message}`);
        }
    }
    /**
     * Bulk register documents (for batch operations).
     */
    async registerDocuments(docs) {
        try {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO cache_documents (id, hash, tokens_estimated, last_accessed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);
            const insertMany = this.db.transaction((items) => {
                for (const item of items) {
                    stmt.run(item.docId, item.hash, item.tokens);
                }
            });
            insertMany(docs);
        }
        catch (err) {
            throw new Error(`Failed to register documents: ${err.message}`);
        }
    }
    /**
     * Bulk log accesses (for batch operations).
     */
    async logBatchAccesses(accesses) {
        try {
            const stmt = this.db.prepare(`
        INSERT INTO cache_accesses (doc_id, hash, was_hit, cache_read_tokens, input_tokens)
        VALUES (?, ?, ?, ?, ?)
      `);
            const insertMany = this.db.transaction((items) => {
                for (const item of items) {
                    stmt.run(item.docId, item.hash, item.hit ? 1 : 0, item.cacheReadTokens || 0, item.inputTokens || 0);
                }
            });
            insertMany(accesses);
            // Update all metrics in one pass
            const metricsStmt = this.db.prepare(`
        INSERT INTO cache_metrics (hash, total_hits, total_misses)
        SELECT hash, SUM(CASE WHEN was_hit = 1 THEN 1 ELSE 0 END),
               SUM(CASE WHEN was_hit = 0 THEN 1 ELSE 0 END)
        FROM cache_accesses
        GROUP BY hash
        ON CONFLICT(hash) DO UPDATE SET
          total_hits = total_hits + EXCLUDED.total_hits,
          total_misses = total_misses + EXCLUDED.total_misses,
          last_updated = CURRENT_TIMESTAMP
      `);
            metricsStmt.run();
        }
        catch (err) {
            throw new Error(`Failed to log batch accesses: ${err.message}`);
        }
    }
}
//# sourceMappingURL=SQLiteRegistry.js.map