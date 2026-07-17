import { emit, loadJson, required, sha256 } from './_runtime.js';
export function run(): void { const m = loadJson('repo_integrity_manifest.json') as any; const files = Object.keys(m.hashes ?? {}); const violations = [...required(files), ...files.filter((f) => !required([f]).length && sha256(f) !== m.hashes[f]).map((f) => `HASH:${f}`)]; emit({ artifact_immutability: { status: violations.length ? 'FAIL' : 'PASS', checked: files.sort(), violations } }, violations.length > 0); }
if (process.argv[1]?.endsWith('artifact_immutability.ts')) run();
