import { emit, scan } from './_runtime.js';
export function run(): void { const files = scan('governance'); const violations = files.filter((p) => !/^governance\/(gates|amendments|RUNTIME-ACTIVATION-CONFIRMATION|COMMIT-CONFIRMATION)\.json$/.test(p)); emit({ governance_surface_snapshot: { status: violations.length ? 'FAIL' : 'PASS', files, violations } }, violations.length > 0); }
if (process.argv[1]?.endsWith('governance_surface_snapshotter.ts')) run();
