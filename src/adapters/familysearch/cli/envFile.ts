import { readFileSync } from "node:fs";

export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out[match[1]] = value;
  }
  return out;
}

export function extractEnvFileArg(argv: string[]): {
  envFile?: string;
  rest: string[];
} {
  const rest: string[] = [];
  let envFile: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--env-file") {
      envFile = argv[++i];
      if (!envFile) throw new Error("--env-file requires a path");
    } else if (argv[i].startsWith("--env-file=")) {
      envFile = argv[i].slice("--env-file=".length);
    } else {
      rest.push(argv[i]);
    }
  }
  return { envFile, rest };
}

export function loadVars(
  envFile: string | undefined,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  if (!envFile) return { ...base };
  return { ...parseEnvText(readFileSync(envFile, "utf8")), ...base };
}
