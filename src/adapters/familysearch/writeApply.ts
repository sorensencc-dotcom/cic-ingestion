import { FAMILYSEARCH_HOSTS, FamilySearchEnv, parseFamilySearchEnv } from "./environments";
import { WriteResponse } from "./FamilySearchAdapter";
import { GedcomxDocument } from "./schema";
import {
  DedupeKey,
  PersonReader,
  PlannedOperation,
  WritePlan,
  descriptionIdOf,
  findDescription,
} from "./writePlan";

export interface PersonWriter extends PersonReader {
  readonly env: FamilySearchEnv;
  postGedcomx(path: string, body: unknown): Promise<WriteResponse>;
}

export interface ApplyOptions {
  confirm: boolean;
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
  const doc = await options.writer.readPerson(plan.pid);
  const createdIds = new Map<string, string>();
  const results: OperationResult[] = [];
  let lastPost = 0;
  let halted = false;

  for (const op of plan.operations) {
    if (halted) {
      results.push({ opId: op.id, status: "not_run" });
      continue;
    }
    if (isPresent(op.dedupe, doc, plan.pid)) {
      if (op.dedupe.kind === "source") {
        const existing = findDescription(doc, op.dedupe.about, op.dedupe.marker);
        if (existing?.id) {
          createdIds.set(op.id, `${host}/platform/sources/descriptions/${existing.id}`);
        }
      }
      results.push({ opId: op.id, status: "already_present" });
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
    if (!(await options.confirmOperation(op))) {
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

export function isPresent(key: DedupeKey, doc: GedcomxDocument, pid: string): boolean {
  const person = doc.persons?.find((p) => p.id === pid);
  if (!person) return false;
  switch (key.kind) {
    case "note":
      return (person.notes ?? []).some((n) => n.text?.includes(key.marker));
    case "source":
      return !!findDescription(doc, key.about, key.marker);
    case "attachment": {
      const sd = findDescription(doc, key.about, key.marker);
      if (!sd?.id) return false;
      return (person.sources ?? []).some(
        (s) => descriptionIdOf(s.description ?? s.descriptionId) === sd.id
      );
    }
    case "fact":
      return (person.facts ?? []).some(
        (f) =>
          f.type === key.factType &&
          (!key.year || (f.date?.formal ?? f.date?.original ?? "").includes(key.year)) &&
          (!key.place || (f.place?.original ?? "").toLowerCase().includes(key.place.toLowerCase()))
      );
    case "name":
      return (person.names ?? []).some((n) =>
        (n.nameForms ?? []).some(
          (form) => form.fullText?.toLowerCase() === key.fullText.toLowerCase()
        )
      );
  }
}
