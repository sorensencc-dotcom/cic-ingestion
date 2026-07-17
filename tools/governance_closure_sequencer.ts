import { emit, loadJson } from './_runtime.js';
export function run(): void { const events = (loadJson('governance/amendments.json') as any).events ?? []; const expected = ['OPENED','REVIEWED','CLOSED']; const violations = events.map((e: any) => e.state).join(',') === expected.join(',') || events.length === 0 ? [] : ['INVALID_CLOSURE_SEQUENCE']; emit({ governance_closure: { status: violations.length ? 'FAIL' : 'PASS', violations } }, violations.length > 0); }
if (process.argv[1]?.endsWith('governance_closure_sequencer.ts')) run();
