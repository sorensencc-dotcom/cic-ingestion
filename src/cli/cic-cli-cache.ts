/**
 * Cache management CLI (Phase 2.4)
 * Commands: status, clear, metrics, watch
 */

import { Command } from 'commander';
import { CICPromptCacheRouter } from '../prompt-cache/router';
import { CacheMetricsExporter } from '../prompt-cache/metrics/CacheMetricsExporter';
import { loadCacheConfig } from '../prompt-cache/config/index';
import * as readline from 'readline';

export function createCacheCommand(): Command {
  const cacheCommand = new Command('cache').description(
    'Cache management and monitoring'
  );

  const config = loadCacheConfig();

  /**
   * cache status — Show current cache metrics
   */
  cacheCommand
    .command('status')
    .description('Show cache status')
    .action(async () => {
      try {
        const router = new CICPromptCacheRouter(config);
        const summary = router.getSummary();

        console.log('\n📊 Cache Status\n');
        console.log(`Eligible documents:   ${summary.eligible_docs}`);
        console.log(
          `Cache hit rate:       ${summary.overall_hit_rate_percent.toFixed(1)}%`
        );
        console.log(`Total cache hits:     ${summary.total_cache_hits}`);
        console.log(`Total cache misses:   ${summary.total_cache_misses}`);
        console.log(`Tokens saved:         ${summary.total_cache_read_tokens_saved.toLocaleString()}`);

        const weeklySavings =
          (summary.total_cache_read_tokens_saved / 1_000_000) * 0.3;
        console.log(
          `Estimated weekly:     $${weeklySavings.toFixed(2)}\n`
        );
      } catch (err) {
        console.error('❌ Failed to get cache status:', err);
        process.exit(1);
      }
    });

  /**
   * cache clear — Remove all cached documents
   */
  cacheCommand
    .command('clear')
    .description('Clear entire cache registry')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (opts: { force?: boolean }) => {
      try {
        const router = new CICPromptCacheRouter(config);
        const summary = router.getSummary();

        if (!opts.force) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });

          await new Promise<void>((resolve) => {
            rl.question(
              `⚠️  Delete ${summary.eligible_docs} documents? (y/N) `,
              (answer) => {
                rl.close();
                if (answer.toLowerCase() !== 'y') {
                  console.log('Cancelled.');
                  process.exit(0);
                }
                resolve();
              }
            );
          });
        }

        router.clearRegistry();
        console.log(`✅ Cleared ${summary.eligible_docs} documents\n`);
      } catch (err) {
        console.error('❌ Failed to clear cache:', err);
        process.exit(1);
      }
    });

  /**
   * cache metrics — Export metrics in JSON or Prometheus format
   */
  cacheCommand
    .command('metrics')
    .description('Export cache metrics')
    .option('--format <format>', 'Output format (json|prometheus)', 'json')
    .action(async (opts: { format?: string }) => {
      try {
        const router = new CICPromptCacheRouter(config);
        const summary = router.getSummary();

        if (opts.format === 'prometheus') {
          const prometheusText = CacheMetricsExporter.exportPrometheus(summary);
          console.log('\n' + prometheusText);
        } else {
          // JSON format
          const jsonMetrics = CacheMetricsExporter.exportJSON(summary);
          console.log('\n' + JSON.stringify(jsonMetrics, null, 2) + '\n');
        }
      } catch (err) {
        console.error('❌ Failed to export metrics:', err);
        process.exit(1);
      }
    });

  /**
   * cache watch — Real-time monitoring with periodic refresh
   */
  cacheCommand
    .command('watch')
    .description('Real-time cache monitoring')
    .option('--interval <ms>', 'Poll interval in milliseconds', '5000')
    .action((opts: { interval?: string }) => {
      try {
        const interval = parseInt(opts.interval || '5000', 10);

        if (interval < 1000) {
          console.error('❌ Interval must be at least 1000ms');
          process.exit(1);
        }

        const router = new CICPromptCacheRouter(config);

        // Display immediately
        const displayStatus = () => {
          const summary = router.getSummary();
          console.clear();
          console.log(`[${new Date().toISOString()}] 📊 Cache Monitor\n`);
          console.log(
            `Hit rate:    ${summary.overall_hit_rate_percent.toFixed(1)}%`
          );
          console.log(`Hits:        ${summary.total_cache_hits}`);
          console.log(`Misses:      ${summary.total_cache_misses}`);
          console.log(
            `Tokens:      ${summary.total_cache_read_tokens_saved.toLocaleString()}\n`
          );
          console.log(`Press Ctrl+C to stop.`);
        };

        displayStatus();

        // Poll periodically
        setInterval(displayStatus, interval);
      } catch (err) {
        console.error('❌ Watch failed:', err);
        process.exit(1);
      }
    });

  return cacheCommand;
}


