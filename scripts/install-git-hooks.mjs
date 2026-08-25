import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

let gitDir;
try {
  gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd: repoRoot, encoding: 'utf8' }).trim();
} catch {
  process.exit(0);
}

const hooksDir = path.resolve(repoRoot, gitDir, 'hooks');
fs.mkdirSync(hooksDir, { recursive: true });

const hookPath = path.join(hooksDir, 'pre-commit');
const hookBody = `#!/bin/sh
node "${path.relative(repoRoot, path.join(here, 'secret-scan.mjs')).split(path.sep).join('/')}" || exit 1
`;

fs.writeFileSync(hookPath, hookBody, { mode: 0o755 });
console.log('Installed pre-commit secret-scan hook.');
