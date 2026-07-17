import { runTool } from './_runtime.js';
const steps = ['governance_surface_snapshotter.ts', 'governance_activation_validator.ts', 'corruption_quarantine_auditor.ts'];
const results = steps.map((step) => runTool(step));
const failures = results.filter((x) => x.status === 'FAIL');
process.stdout.write(`${JSON.stringify({ nightly_governance_audit: { steps: results, status: failures.length ? 'FAIL' : 'PASS', failures: failures.map((x) => x.step) } })}\n`);
process.exit(failures.length ? 1 : 0);
