import { execFileSync } from 'node:child_process';

const root = 'C:/dev/cic-ingestion';
const tracked = [
  'artifacts/treatment',
  'packets',
  'specs',
];
const output = execFileSync('git', ['-C', root, 'diff', '--no-ext-diff', '--unified=0', '--', ...tracked], { encoding: 'utf8' });
const files: Array<{ file: string; lines: number[]; governance: boolean; lineage: boolean }> = [];
let current: (typeof files)[number] | undefined;
for (const line of output.split(/\r?\n/)) {
  if (line.startsWith('+++ b/')) {
    const file = line.slice(6);
    current = { file: `${root}/${file}`, lines: [], governance: /treatment|spec/i.test(file), lineage: /lineage|packet|spec/i.test(file) };
    files.push(current);
  } else if (current && line.startsWith('@@')) {
    const match = line.match(/\+(\d+)/);
    if (match) current.lines.push(Number(match[1]));
  }
}
const changed = files.sort((a, b) => a.file.localeCompare(b.file)).map((file) => ({ ...file, lines: [...new Set(file.lines)].sort((a, b) => a - b) }));
process.stdout.write(`${JSON.stringify({ artifact_change_diff: { artifacts_changed: changed, follow_up_required: changed.some((x) => x.governance || x.lineage) } })}\n`);
