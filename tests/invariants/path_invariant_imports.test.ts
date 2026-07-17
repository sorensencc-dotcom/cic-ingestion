import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'C:/dev/cic-ingestion';
const SKIP = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const DEPRECATED = /(?:rewrite-mcp|castironforge|cic-ingestion\/cic-ingestion|src\/legacy|src\/deprecated)/i;
function files(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap((e) => SKIP.has(e.name) ? [] : e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]); }

describe('import path invariant', () => {
  it('rejects deprecated import directories', () => {
    const violations: string[] = [];
    for (const file of files(ROOT)) {
      if (!/\.(?:js|jsx|mjs|ts|tsx)$/.test(file)) continue;
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        if (/\b(?:import|export)\b[\s\S]*?\bfrom\s*['"]|\brequire\s*\(/.test(line) && DEPRECATED.test(line)) violations.push(`${file}:${index + 1}:${line.trim()}`);
      });
    }
    expect(violations, 'FAIL DEPRECATED_IMPORT_PATH').toEqual([]);
  });
});
