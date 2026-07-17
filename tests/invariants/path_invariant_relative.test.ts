import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, win32 } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'C:/dev/cic-ingestion';
const SKIP = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const TEXT = /\.(?:cjs|js|json|md|mjs|ps1|py|sh|ts|tsx|yml|yaml)$/i;
function files(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap((e) => SKIP.has(e.name) ? [] : e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]); }

describe('relative path invariant', () => {
  it('rejects relative paths escaping project root', () => {
    const violations: string[] = [];
    for (const file of files(ROOT)) {
      if (!TEXT.test(file)) continue;
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
        for (const match of line.matchAll(/(?:['"`])((?:\.\.?[\\/])+[^'"`]*)['"`]/g)) {
          const value = match[1].replaceAll('\\', '/');
          const resolved = posix.normalize(posix.join(posix.dirname(file.replaceAll('\\', '/')), value));
          if (win32.relative(ROOT.replaceAll('/', '\\'), resolved.replaceAll('/', '\\')).startsWith('..')) violations.push(`${file}:${index + 1}:${value}`);
        }
      });
    }
    expect(violations, 'FAIL RELATIVE_PATH_ESCAPES_ROOT').toEqual([]);
  });
});
