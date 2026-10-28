import { mkdirSync, writeFileSync } from "node:fs";
import { FamilySearchAdapter } from "../src/adapters/familysearch/FamilySearchAdapter";
import { extractEnvFileArg, loadVars } from "../src/adapters/familysearch/cli/envFile";
import { formatPersonSummary, redactSecrets } from "../src/adapters/familysearch/cli/personSummary";

async function main(): Promise<void> {
  const { envFile, rest } = extractEnvFileArg(process.argv.slice(2));
  const pid = rest.find((a) => !a.startsWith("--"));
  if (!pid || !/^[A-Z0-9-]+$/i.test(pid)) {
    throw new Error("Usage: npm run fs:read -- <PID> [--env-file <path>]");
  }
  const adapter = FamilySearchAdapter.fromEnv(loadVars(envFile));
  const doc = await adapter.readPerson(pid);
  console.log(formatPersonSummary(doc, pid));
  mkdirSync(".tmp", { recursive: true });
  const out = `.tmp/fs-person-${pid}.json`;
  writeFileSync(out, JSON.stringify(redactSecrets(doc), null, 2));
  console.log(`\nRedacted raw copy: ${out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "read failed");
  process.exit(1);
});
