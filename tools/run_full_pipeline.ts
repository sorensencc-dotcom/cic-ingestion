import { emit, runTool, scan } from './_runtime.js';
const excluded = new Set(['_runtime.ts', 'run_full_pipeline.ts']); // support library and orchestrator; prevent recursive execution.
const steps = scan('tools').filter((p) => p.endsWith('.ts') && !excluded.has(p.split('/').pop()!)).map((p) => p.split('/').pop()!).sort();
const results = steps.map((step) => runTool(step));
const failures = results.filter((entry) => entry.status === 'FAIL');
process.stdout.write(`${JSON.stringify({ pipeline_execution: { steps: results, status: failures.length ? 'FAIL' : 'PASS', failures: failures.map((entry) => ({ step: entry.step, result: entry.result })) } })}\n`);
process.exit(failures.length ? 1 : 0);
