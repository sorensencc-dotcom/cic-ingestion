import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, emit, loadJson, required } from './_runtime.js';
export function run(): void { const draft = 'artifacts/treatment/treatment_draft_v1.1.md'; const text = readFileSync(join(ROOT, draft), 'utf8'); const packet = loadJson('packets/compressed_packet_v1.json') as any; const violations: string[] = [...required([draft,'artifacts/treatment/treatment_framework_spec_v1.md','packets/compressed_packet_v1.json']), ...['# Treatment Draft v1.1','### Beat 001','### Beat 002','### Beat 003'].filter((x) => !text.includes(x)), ...(packet.$id !== 'compressed_packet_v1' ? ['PACKET_SCHEMA_ID'] : [])]; emit({ treatment_regression: { status: violations.length ? 'FAIL' : 'PASS', draft, violations } }, violations.length > 0); }
if (process.argv[1]?.endsWith('treatment_regression_harness.ts')) run();
