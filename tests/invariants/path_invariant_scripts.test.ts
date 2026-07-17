import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'C:/dev/cic-ingestion';
const SKIP = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const FORBIDDEN = /rewrite-mcp|castironforge/i;
function files(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap((e) => SKIP.has(e.name) ? [] : e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]); }

describe('script path invariant', () => {
  it('rejects deprecated repository references in scripts and configs', () => {
    const violations: string[] = [];
    for (const file of files(ROOT)) {
      if (!/\.(?:cjs|js|json|mjs|ps1|py|sh|ts|tsx|yml|yaml)$/.test(file)) continue;
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => { if (FORBIDDEN.test(line)) violations.push(`${file}:${index + 1}:${line.trim()}`); });
    }
    expect(violations, 'FAIL DEPRECATED_SCRIPT_REFERENCE').toEqual([]);
  });
});
