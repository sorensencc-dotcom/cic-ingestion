import * as readline from "node:readline/promises";
import { FamilySearchAdapter } from "../src/adapters/familysearch/FamilySearchAdapter";
import { main } from "../src/adapters/familysearch/cli/apply";
import { extractEnvFileArg, loadVars } from "../src/adapters/familysearch/cli/envFile";

async function run(): Promise<number> {
  const { envFile, rest } = extractEnvFileArg(process.argv.slice(2));
  const vars = loadVars(envFile);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await main(rest, {
      writer: FamilySearchAdapter.fromEnv(vars),
      prompt: (q) => rl.question(q),
      log: (line) => console.log(line),
      vars,
      ledgerPath: vars.FS_APPLY_LEDGER ?? ".tmp/fs-apply-ledger.jsonl",
    });
  } finally {
    rl.close();
  }
}

run().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error(e instanceof Error ? e.message : "fs:apply failed");
    process.exitCode = 1;
  }
);
