import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import { FAMILYSEARCH_HOSTS } from "../environments";
import { WriteResponse } from "../FamilySearchAdapter";
import { PersonWriter, applyPlan } from "../writeApply";
import {
  PlanOptions,
  PlannedOperation,
  ProposedFinding,
  WritePlan,
  buildPlan,
  dayOf,
  descriptionIdOf,
  fingerprint,
  loadPerson,
  norm,
} from "../writePlan";

export interface ApplyCliDeps {
  /** Reads the person and, for `apply`, posts. Only the user's terminal wires a real one. */
  writer: PersonWriter;
  /** Asks one question, returns the typed answer. */
  prompt: (question: string) => Promise<string>;
  log: (line: string) => void;
  /** Environment variables, including FAMILYSEARCH_ENV for the write guard. */
  vars: NodeJS.ProcessEnv;
  ledgerPath: string;
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const PLAN_FILE_VERSION = 1;

export interface PlanFile {
  version: number;
  pid: string;
  env: string;
  findings: ProposedFinding[];
  planOptions: { existingSources: Record<string, string>; allowConclusions: boolean };
  plan: WritePlan;
  /** sha256 over the canonical pid, operations and findings; `apply --hash` must match it. */
  hash: string;
}

const VALUE_FLAGS = new Set([
  "pid",
  "findings",
  "extract",
  "out",
  "plan",
  "hash",
  "only",
  "existing-source",
]);
const BOOL_FLAGS = new Set(["allow-conclusions", "source-absent-verified"]);

interface Parsed {
  command: string;
  values: Map<string, string[]>;
  bools: Set<string>;
}

function parseArgs(argv: string[]): Parsed {
  const [command, ...rest] = argv;
  const values = new Map<string, string[]>();
  const bools = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("--")) throw new Error(`unexpected argument "${arg}"`);
    const eq = arg.indexOf("=");
    const name = arg.slice(2, eq === -1 ? undefined : eq);
    if (BOOL_FLAGS.has(name)) {
      if (eq !== -1) throw new Error(`--${name} takes no value`);
      bools.add(name);
    } else if (VALUE_FLAGS.has(name)) {
      const value = eq !== -1 ? arg.slice(eq + 1) : rest[++i];
      if (value === undefined || value === "") throw new Error(`--${name} requires a value`);
      values.set(name, [...(values.get(name) ?? []), value]);
    } else {
      throw new Error(`unknown option --${name}`);
    }
  }
  return { command: command ?? "", values, bools };
}

const one = (p: Parsed, name: string): string | undefined => {
  const all = p.values.get(name);
  if (all && all.length > 1) throw new Error(`--${name} given more than once`);
  return all?.[0];
};
const required = (p: Parsed, name: string): string => {
  const v = one(p, name);
  if (!v) throw new Error(`--${name} is required`);
  return v;
};

function parseExistingSources(p: Parsed): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of p.values.get("existing-source") ?? []) {
    const at = pair.indexOf("=");
    const src = pair.slice(0, at).trim();
    const id = pair.slice(at + 1).trim();
    if (at < 1 || !id) throw new Error(`--existing-source expects SRC=ID, got "${pair}"`);
    out[src] = id;
  }
  return out;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * The hash covers the operations and also the findings and person id: applyPlan re-plans
 * from the findings, so a file with edited findings must not pass for the reviewed plan.
 */
export function hashPlan(pid: string, plan: WritePlan, findings: ProposedFinding[]): string {
  return sha256(canonicalJson({ pid, operations: plan.operations, findings }));
}

function readJson(path: string, what: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`cannot read ${what} ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The TRM extract keeps free-text facts only: id, text, source_id, confidence, categories. */
export function verifyAgainstExtract(findings: unknown[], extract: unknown): void {
  const facts = Array.isArray(extract)
    ? extract
    : (extract as { facts?: unknown } | null)?.facts;
  if (!Array.isArray(facts)) throw new Error("extract has no facts array");
  const sources = new Map<string, Set<string>>();
  for (const fact of facts as Array<Record<string, unknown>>) {
    if (typeof fact?.id !== "string" || typeof fact.source_id !== "string") continue;
    sources.set(fact.id, (sources.get(fact.id) ?? new Set()).add(fact.source_id));
  }
  const problems: string[] = [];
  for (const raw of findings) {
    const f = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const label = `${String(f.trmSourceId ?? "?")}/${String(f.trmFactId ?? "?")}`;
    const found = typeof f.trmFactId === "string" ? sources.get(f.trmFactId) : undefined;
    if (!found) {
      problems.push(`${label}: fact id is not in the extract`);
    } else if (found.size !== 1 || !found.has(String(f.trmSourceId))) {
      problems.push(
        `${label}: extract says source ${[...found].join("/")}, finding says ${String(f.trmSourceId)}`
      );
    }
  }
  if (problems.length) {
    throw new Error(`findings do not match the extract (fact ids renumber on regenerate):\n  ${problems.join("\n  ")}`);
  }
}

// --- ledger -----------------------------------------------------------------------------

interface LedgerEntry {
  phase: "intent" | "done";
  key: string;
  pid: string;
  opType: string;
  target: string;
  bodyHash: string;
  at: string;
  opId?: string;
  location?: string;
  entityId?: string;
}

export class LedgerRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerRefusedError";
  }
}

function readLedger(path: string): LedgerEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l) as LedgerEntry;
      } catch {
        throw new LedgerRefusedError(`ledger ${path} line ${i + 1} is not valid JSON; fix it by hand`);
      }
    });
}

function appendLedger(path: string, entry: LedgerEntry): void {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, "a");
  try {
    writeSync(fd, `${JSON.stringify(entry)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** What is being posted, independent of finding ids, which renumber. */
function targetOf(op: PlannedOperation, body: unknown): string | undefined {
  const person = (body as { persons?: Array<Record<string, any>> } | null)?.persons?.[0];
  switch (op.type) {
    case "create_source_description":
      return op.dedupe.kind === "source" ? op.dedupe.about ?? op.dedupe.marker : undefined;
    case "attach_source": {
      const ref = person?.sources?.[0]?.description;
      // An unresolved @op ref points at a description that does not exist yet.
      if (typeof ref !== "string" || ref.startsWith("@op:")) return undefined;
      return descriptionIdOf(ref);
    }
    case "add_note":
      return op.dedupe.kind === "note" ? op.dedupe.marker : undefined;
    case "add_fact": {
      const fact = person?.facts?.[0];
      const date: string | undefined = fact?.date?.original;
      const when = date ? dayOf(date) ?? norm(date) : `place:${norm(fact?.place?.original)}`;
      return `${fact?.type}|${when}`;
    }
    case "add_name":
      return op.dedupe.kind === "name" ? norm(op.dedupe.fullText) : undefined;
  }
}

function ledgerKey(pid: string, op: PlannedOperation, target: string): string {
  return `${pid}|${op.type}|${target}`;
}

function checkLedger(path: string, key: string): void {
  const entries = readLedger(path).filter((e) => e.key === key);
  if (entries.some((e) => e.phase === "done")) {
    throw new LedgerRefusedError(`ledger: already posted ${key}`);
  }
  if (entries.length) {
    throw new LedgerRefusedError(
      `ledger: an earlier attempt at ${key} wrote an intent but never completed. ` +
        `Check FamilySearch for the result, then delete that line from ${path} by hand. Not retrying.`
    );
  }
}

// --- display ----------------------------------------------------------------------------

function displayBody(body: unknown, host: string, existingId?: string): string {
  const shown = JSON.parse(JSON.stringify(body), (_k, v) => {
    if (typeof v !== "string") return v;
    if (v.startsWith("@sd:")) return `${host}/platform/sources/descriptions/${existingId ?? v.slice(4)}`;
    if (v.startsWith("@op:")) return `<URL of the description op ${v.slice(4)} will create>`;
    return v;
  });
  return JSON.stringify(shown, null, 2);
}

function requireBeta(writer: PersonWriter): string {
  if (writer.env !== "beta") {
    throw new Error(`fs:apply is beta-only; writer environment is ${writer.env}`);
  }
  const host = FAMILYSEARCH_HOSTS.beta.api;
  if (FAMILYSEARCH_HOSTS[writer.env].api !== host) throw new Error("API host is not the beta host");
  return host;
}

// --- subcommands ------------------------------------------------------------------------

async function runPlan(p: Parsed, deps: ApplyCliDeps): Promise<number> {
  const host = requireBeta(deps.writer);
  const pid = required(p, "pid");
  const findingsRaw = readJson(required(p, "findings"), "findings");
  if (!Array.isArray(findingsRaw)) throw new Error("--findings must be a JSON array");
  verifyAgainstExtract(findingsRaw, readJson(required(p, "extract"), "extract"));
  const findings = findingsRaw as ProposedFinding[];
  const existingSources = parseExistingSources(p);
  const allowConclusions = p.bools.has("allow-conclusions");
  const options: PlanOptions = { existingSources, allowConclusions };

  deps.log(`Environment: beta  API host: ${host}`);
  const doc = await loadPerson(deps.writer, pid);
  const plan = buildPlan(pid, findings, doc, options);
  const hash = hashPlan(pid, plan, findings);
  const file: PlanFile = {
    version: PLAN_FILE_VERSION,
    pid,
    env: deps.writer.env,
    findings,
    planOptions: { existingSources, allowConclusions },
    plan,
    hash,
  };
  const out = required(p, "out");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(file, null, 2));

  for (const op of plan.operations) deps.log(`  ${fingerprint(op)}  ${op.type}  ${op.rationale}`);
  if (!plan.operations.length) deps.log("  (no operations)");
  for (const s of plan.skipped) deps.log(`  skipped ${s.findingId} ${s.operation}: ${s.reason}`);
  for (const d of plan.dropped) deps.log(`  dropped ${d.findingId}: ${d.reason}`);
  deps.log(`Plan written to ${out}\nHash: ${hash}`);
  return 0;
}

async function runApply(p: Parsed, deps: ApplyCliDeps): Promise<number> {
  const host = requireBeta(deps.writer);
  const file = readJson(required(p, "plan"), "plan") as PlanFile;
  const hash = required(p, "hash").trim().toLowerCase();
  if (file?.version !== PLAN_FILE_VERSION || !file.plan?.operations || !Array.isArray(file.findings)) {
    throw new Error("plan file is not a version-1 fs:apply plan");
  }
  const actual = hashPlan(file.pid, file.plan, file.findings);
  if (actual !== hash || file.hash !== actual) {
    throw new Error(`plan hash mismatch: the plan file does not match --hash (file computes ${actual})`);
  }
  if (file.env !== deps.writer.env) {
    throw new Error(`plan was made for ${file.env}; writer is ${deps.writer.env}`);
  }

  let plan = file.plan;
  const only = one(p, "only");
  if (only !== undefined) {
    const ops = plan.operations.filter((o) => fingerprint(o) === only);
    if (!ops.length) {
      throw new Error(
        `--only "${only}" matches no operation; have: ${plan.operations.map(fingerprint).join(", ") || "(none)"}`
      );
    }
    plan = { ...plan, operations: ops };
  }
  const planOptions: PlanOptions = {
    allowConclusions: file.planOptions?.allowConclusions,
    existingSources: { ...file.planOptions?.existingSources, ...parseExistingSources(p) },
  };

  deps.log(`Environment: beta  API host: ${host}`);
  let current: PlannedOperation | undefined;
  // The ledger sits under the writer so it sees the body exactly as it is sent.
  const guarded: PersonWriter = {
    env: deps.writer.env,
    readPerson: (pid) => deps.writer.readPerson(pid),
    readNotes: deps.writer.readNotes ? (pid) => deps.writer.readNotes!(pid) : undefined,
    async postGedcomx(path: string, body: unknown): Promise<WriteResponse> {
      const op = current;
      if (!op) throw new LedgerRefusedError("post without a confirmed operation");
      const target = targetOf(op, body);
      if (target === undefined) throw new LedgerRefusedError(`cannot determine the target of ${fingerprint(op)}`);
      const key = ledgerKey(file.pid, op, target);
      checkLedger(deps.ledgerPath, key);
      const base = {
        key,
        pid: file.pid,
        opType: op.type,
        target,
        bodyHash: sha256(canonicalJson(body)),
        opId: op.id,
      };
      appendLedger(deps.ledgerPath, { phase: "intent", at: new Date().toISOString(), ...base });
      const response = await deps.writer.postGedcomx(path, body);
      appendLedger(deps.ledgerPath, {
        phase: "done",
        at: new Date().toISOString(),
        ...base,
        location: response.location,
        entityId: response.entityId,
      });
      return response;
    },
  };

  const results = await applyPlan(plan, {
    confirm: true,
    findings: file.findings,
    planOptions,
    sourceDescriptionsVerified: p.bools.has("source-absent-verified"),
    env: deps.vars,
    writer: guarded,
    minIntervalMs: deps.minIntervalMs,
    sleep: deps.sleep,
    confirmOperation: async (op) => {
      deps.log(`\nEnvironment: ${deps.writer.env}  API host: ${host}`);
      deps.log(`Operation: ${fingerprint(op)}  (${op.type})`);
      deps.log(`POST ${host}${op.path}`);
      deps.log(displayBody(op.body, host, op.existingDescriptionId));
      const early = targetOf(op, JSON.parse(displayBody(op.body, host, op.existingDescriptionId)));
      if (early !== undefined && !early.startsWith("<")) {
        try {
          checkLedger(deps.ledgerPath, ledgerKey(file.pid, op, early));
        } catch (e) {
          deps.log(`Refusing: ${e instanceof Error ? e.message : String(e)}`);
          return false;
        }
      }
      const answer = (
        await deps.prompt(`Post to FamilySearch BETA (${host})? Type yes: `)
      )
        .trim()
        .toLowerCase();
      if (answer !== "yes") return false;
      current = op;
      return true;
    },
  });

  deps.log("\nResults:");
  for (const r of results) deps.log(JSON.stringify(r));
  return results.some((r) => r.status === "failed") ? 1 : 0;
}

/** Entry point. Returns the exit code; never exits the process. */
export async function main(argv: string[], deps: ApplyCliDeps): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    if (parsed.command === "plan") return await runPlan(parsed, deps);
    if (parsed.command === "apply") return await runApply(parsed, deps);
    throw new Error(
      "usage: fs:apply plan --pid P --findings f.json --extract e.json --out plan.json [--existing-source SRC=ID] [--allow-conclusions]\n" +
        "       fs:apply apply --plan plan.json --hash H [--only 'fingerprint'] [--existing-source SRC=ID] [--source-absent-verified]"
    );
  } catch (e) {
    deps.log(e instanceof Error ? `${e.name}: ${e.message}` : "fs:apply failed");
    return 1;
  }
}
