import { execFileSync } from 'node:child_process';

const PATTERNS = [
  { name: 'connection-string-credential', re: /:\/\/[^\s'"/]+:[^\s'"/@]+@[^\s'"/]+/g },
  { name: 'generic-password-assignment', re: /\b(password|passwd|pwd)\s*[:=]\s*['"][^'"\s]{4,}['"]/gi },
  { name: 'generic-api-key-assignment', re: /\b(api[_-]?key|secret|token)\s*[:=]\s*['"][^'"\s]{8,}['"]/gi },
  { name: 'aws-access-key-id', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

const ALLOWLIST = [
  // devops/automation/terraform/main.tf: self-flagged Terraform placeholder,
  // literally named CHANGE_ME_SECURELY — not a real credential.
  /CHANGE_ME_SECURELY/,
];

function stagedFiles() {
  return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !/\.(png|jpg|jpeg|gif|ico|lock)$/i.test(f));
}

function stagedContent(file) {
  try {
    return execFileSync('git', ['show', `:${file}`], { encoding: 'utf8' });
  } catch {
    return '';
  }
}

let hits = [];
for (const file of stagedFiles()) {
  const content = stagedContent(file);
  if (!content) continue;
  for (const { name, re } of PATTERNS) {
    const matches = content.match(re) || [];
    for (const m of matches) {
      if (ALLOWLIST.some((a) => a.test(m))) continue;
      hits.push(`${file}: ${name} -> ${m.slice(0, 60)}`);
    }
  }
}

if (hits.length) {
  console.error('\nsecret-scan: possible credential(s) in staged changes:\n');
  for (const h of hits) console.error('  ' + h);
  console.error('\nIf this is a false positive (fixture data, disposable local/CI-only credential),');
  console.error('rename the string so it does not look like a real secret, or add it to ALLOWLIST');
  console.error('in scripts/secret-scan.mjs with a comment explaining why.\n');
  process.exit(1);
}
