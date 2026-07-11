/**
 * CIC v3.0 — Structured Logger
 * File: cic/core/logger.js | Version: 1.0.0 | Date: 2026-05-15
 */

export function createLogger(module) {
  return {
    info(msg, ctx = {}) {
      process.stdout.write(
        JSON.stringify({ level: 'info', module, msg, ...ctx, ts: Date.now() }) + '\n'
      );
    },
    warn(msg, ctx = {}) {
      process.stderr.write(
        JSON.stringify({ level: 'warn', module, msg, ...ctx, ts: Date.now() }) + '\n'
      );
    },
    error(msg, ctx = {}) {
      process.stderr.write(
        JSON.stringify({ level: 'error', module, msg, ...ctx, ts: Date.now() }) + '\n'
      );
    },
  };
}
