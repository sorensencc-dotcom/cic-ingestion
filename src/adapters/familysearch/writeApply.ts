import { FAMILYSEARCH_HOSTS, FamilySearchEnv, parseFamilySearchEnv } from "./environments";
import { WriteResponse } from "./FamilySearchAdapter";
import {
  PersonReader,
  PlanOptions,
  PlannedOperation,
  ProposedFinding,
  WritePlan,
  buildPlan,
  descriptionIdOf,
  fingerprint,
  loadPerson,
} from "./writePlan";

export interface PersonWriter extends PersonReader {
  readonly env: FamilySearchEnv;
  postGedcomx(path: string, body: unknown): Promise<WriteResponse>;
}

export interface ApplyOptions {
  confirm: boolean;
  /** The findings the reviewed plan was built from; apply re-plans from them. */
  findings: ProposedFinding[];
  planOptions?: PlanOptions;
  env: NodeJS.ProcessEnv;
  writer: PersonWriter;
  confirmOperation: (op: PlannedOperation) => Promise<boolean>;
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export type OperationStatus =
  | "posted"
  | "already_present"
  | "declined"
  | "failed"
  | "not_run";

export interface OperationResult {
  opId: string;
  status: OperationStatus;
  location?: string;
  entityId?: string;
  error?: string;
}

export class WriteRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteRefusedError";
  }
}

export function assertWritesAllowed(
  env: NodeJS.ProcessEnv,
  adapterEnv: FamilySearchEnv
): void {
  const configured = env.FAMILYSEARCH_ENV?.trim().toLowerCase();
  const optedIn = env.FAMILYSEARCH_ALLOW_PRODUCTION_WRITES === "1";
  if (adapterEnv === "production" && !optedIn) {
    throw new WriteRefusedError(
      "Refusing production write: set FAMILYSEARCH_ALLOW_PRODUCTION_WRITES=1"
    );
  }
  if (configured !== "beta" && !optedIn) {
    throw new WriteRefusedError(
      "Refusing write: set FAMILYSEARCH_ENV=beta or FAMILYSEARCH_ALLOW_PRODUCTION_WRITES=1"
    );
  }
  if (configured) parseFamilySearchEnv(configured);
}

export async function applyPlan(
  plan: WritePlan,
  options: ApplyOptions
): Promise<OperationResult[]> {
  if (options.confirm !== true) {
    throw new WriteRefusedError("Refusing write: confirm: true is required");
  }
  if (typeof options.confirmOperation !== "function") {
    throw new WriteRefusedError("Refusing write: confirmOperation callback is required");
  }
  assertWritesAllowed(options.env, options.writer.env);

  const sleep = options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const minInterval = options.minIntervalMs ?? 1500;
  const host = FAMILYSEARCH_HOSTS[options.writer.env].api;
  // Every safety rule (living, conflicts, confidence, already-present) runs
  // again against the person as it is now. Only operations the human
  // reviewed AND the fresh plan still produces are executed.
  const doc = await loadPerson(options.writer, plan.pid);
  const fresh = buildPlan(plan.pid, options.findings, doc, options.planOptions);
  const reviewed = new Set(plan.operations.map(fingerprint));
  const freshPrints = new Set(fresh.operations.map(fingerprint));
  const createdIds = new Map<string, string>();
  const results: OperationResult[] = [];
  let lastPost = 0;
  let halted = false;

  for (const stale of plan.operations) {
    if (!freshPrints.has(fingerprint(stale))) {
      results.push({
        opId: stale.id,
        status: "already_present",
        error: "no longer needed or no longer allowed at write time",
      });
    }
  }

  for (const op of fresh.operations.filter((o) => reviewed.has(fingerprint(o)))) {
    if (halted) {
      results.push({ opId: op.id, status: "not_run" });
      continue;
    }
    if (op.dependsOn && !createdIds.has(op.dependsOn)) {
      const dep = results.find((r) => r.opId === op.dependsOn);
      results.push({
        opId: op.id,
        status: dep?.status === "declined" ? "declined" : "not_run",
        error: `dependency ${op.dependsOn} did not produce a source description`,
      });
      continue;
    }
    let approved: boolean;
    try {
      approved = await options.confirmOperation(op);
    } catch (error) {
      halted = true;
      results.push({
        opId: op.id,
        status: "failed",
        error: `confirmation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    if (!approved) {
      results.push({ opId: op.id, status: "declined" });
      continue;
    }

    const wait = lastPost + minInterval - now();
    if (lastPost && wait > 0) await sleep(wait);
    try {
      const body = resolveRefs(op.body, createdIds, host, op.existingDescriptionId);
      const response = await options.writer.postGedcomx(op.path, body);
      lastPost = now();
      const id = response.entityId ?? descriptionIdOf(response.location);
      if (op.type === "create_source_description" && id) {
        createdIds.set(op.id, `${host}/platform/sources/descriptions/${id}`);
      }
      results.push({
        opId: op.id,
        status: "posted",
        location: response.location,
        entityId: response.entityId,
      });
    } catch (error) {
      lastPost = now();
      halted = true;
      results.push({
        opId: op.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

function resolveRefs(
  body: unknown,
  created: Map<string, string>,
  host: string,
  existingId?: string
): unknown {
  return JSON.parse(JSON.stringify(body), (_k, v) => {
    if (typeof v !== "string") return v;
    if (v.startsWith("@op:")) {
      const url = created.get(v.slice(4));
      if (!url) throw new Error(`unresolved reference ${v}`);
      return url;
    }
    if (v.startsWith("@sd:")) {
      return `${host}/platform/sources/descriptions/${existingId ?? v.slice(4)}`;
    }
    return v;
  });
}
