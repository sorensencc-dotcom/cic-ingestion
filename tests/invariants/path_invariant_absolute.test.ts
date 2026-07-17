import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'C:/dev/cic-ingestion';
const SKIP = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const TEXT = /\.(?:cjs|js|json|md|mjs|ps1|py|sh|ts|tsx|yml|yaml)$/i;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const file = join(dir, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}

describe('absolute path invariant', () => {
  it('rejects absolute paths outside project root', () => {
    const violations: string[] = [];
    for (const file of files(ROOT)) {
      if (!TEXT.test(file)) continue;
      const lineNo = readFileSync(file, 'utf8').split(/\r?\n/);
      lineNo.forEach((line, index) => {
        for (const match of line.matchAll(/(?:[A-Za-z]:[\\/]|\\\\)[^\s"'`),;]+/g)) {
          const value = match[0].replaceAll('\\', '/');
          if (/^[A-Za-z]:\//.test(value) && !value.toLowerCase().startsWith(`${ROOT.toLowerCase()}/`) && value.toLowerCase() !== ROOT.toLowerCase()) {
            violations.push(`${file}:${index + 1}:${value}`);
          }
        }
      });
    }
    expect(violations, 'FAIL ABSOLUTE_PATH_OUTSIDE_ROOT').toEqual([]);
  });
});
