import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '').replaceAll('\\', '/');
export const json = (value: unknown): string => JSON.stringify(value);
export function required(paths: string[]): string[] { return paths.filter((p) => !existsSync(join(ROOT, p))); }
export function emit(result: unknown, failed: boolean): never { process.stdout.write(`${json(result)}\n`); process.exit(failed ? 1 : 0); }
export function scan(relative: string): string[] {
  const root = resolve(ROOT, relative);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => e.isDirectory() ? scan(join(relative, e.name)) : [join(relative, e.name).replaceAll('\\', '/')]);
}
export function loadJson(relative: string): unknown { return JSON.parse(readFileSync(join(ROOT, relative), 'utf8')); }
export function sha256(relative: string): string { return createHash('sha256').update(readFileSync(join(ROOT, relative))).digest('hex'); }
export function runTool(step: string, timeout = 120000): { step: string; status: 'PASS' | 'FAIL'; result: unknown } {
  const result = spawnSync(process.execPath, ['--loader', 'ts-node/esm', join(ROOT, 'tools', step)], { cwd: ROOT, encoding: 'utf8', timeout });
  let parsed: unknown = result.status === 0 && !result.error ? { status: 'PASS', output: 'SILENT_PASS' } : { error: result.error?.message ?? 'NO_JSON_OUTPUT' };
  try { if (result.stdout?.trim()) parsed = JSON.parse(result.stdout.trim()); } catch { parsed = { error: 'NON_JSON_OUTPUT', stdout: result.stdout?.trim() ?? '' }; }
  return { step, status: result.status === 0 ? 'PASS' : 'FAIL', result: parsed };
}
