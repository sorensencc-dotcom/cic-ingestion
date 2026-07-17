import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, emit, loadJson } from './_runtime.js';
export function validate(): void { const file = join(ROOT, 'repo_integrity_manifest.json'); if (!existsSync(file)) emit({ error: 'MANIFEST_MISSING', path: file }, true); const m = loadJson('repo_integrity_manifest.json') as { canonical_files?: string[] }; const missing = (m.canonical_files ?? []).filter((p) => !existsSync(join(ROOT, p))); emit({ repo_integrity: { status: missing.length ? 'FAIL' : 'PASS', missing } }, missing.length > 0); }
if (process.argv[1]?.endsWith('repo_integrity_guard.ts')) validate();
