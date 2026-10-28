import { GedcomxDocument, GxFact, GxPerson, GxSourceDescription } from "./schema";

export type FindingKind =
  | "name_variant"
  | "birth"
  | "death"
  | "marriage"
  | "residence"
  | "relationship";

export interface ProposedFinding {
  kind: FindingKind;
  value: string;
  date?: string;
  place?: string;
  sourceUrl?: string;
  sourceTitle: string;
  trmSourceId: string;
  trmFactId: string;
  confidence: number;
  note: string;
}

export type OperationType =
  | "create_source_description"
  | "attach_source"
  | "add_note"
  | "add_fact"
  | "add_name";

export type DedupeKey =
  | { kind: "source"; about?: string; marker: string }
  | { kind: "attachment"; about?: string; marker: string }
  | { kind: "note"; marker: string }
  | { kind: "fact"; factType: string; year?: string; place?: string }
  | { kind: "name"; fullText: string };

export interface PlannedOperation {
  id: string;
  type: OperationType;
  rationale: string;
  evidenceUrl?: string;
  confidence: number;
  findingIds: string[];
  dedupe: DedupeKey;
  dependsOn?: string;
  existingDescriptionId?: string;
  changeMessage: string;
  method: "POST";
  path: string;
  body: unknown;
}

export interface SkippedItem {
  findingId: string;
  operation: OperationType | "finding";
  reason: string;
}

export interface DroppedFinding {
  findingId: string;
  reason: string;
}

export interface WritePlan {
  pid: string;
  operations: PlannedOperation[];
  skipped: SkippedItem[];
  dropped: DroppedFinding[];
}

export interface PlanOptions {
  allowConclusions?: boolean;
  minConfidence?: number;
  now?: () => Date;
}

export interface PersonReader {
  readPerson(pid: string): Promise<GedcomxDocument>;
}

const GX = "http://gedcomx.org/";
const FACT_TYPES: Partial<Record<FindingKind, string>> = {
  birth: `${GX}Birth`,
  death: `${GX}Death`,
  residence: `${GX}Residence`,
};
const UNIQUE_FACTS = new Set<FindingKind>(["birth", "death"]);
const LIVING_WINDOW_YEARS = 110;

export const SD_PATH = "/platform/sources/descriptions";
export const personPath = (pid: string) =>
  `/platform/tree/persons/${encodeURIComponent(pid)}`;

export const findingId = (f: ProposedFinding) => `${f.trmSourceId}/${f.trmFactId}`;
export const marker = (f: ProposedFinding) => `[TRM:${findingId(f)}]`;
const sourceMarker = (f: ProposedFinding) => `[TRM-SOURCE:${f.trmSourceId}]`;

const yearOf = (text?: string) => text?.match(/\d{4}/)?.[0];
const norm = (text?: string) =>
  (text ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function planWrite(
  pid: string,
  findings: ProposedFinding[],
  reader: PersonReader,
  options: PlanOptions = {}
): Promise<WritePlan> {
  return buildPlan(pid, findings, await reader.readPerson(pid), options);
}

export function isPossiblyLiving(person: GxPerson, now: Date): boolean {
  if (person.living === true) return true;
  const facts = person.facts ?? [];
  if (facts.some((f) => f.type === FACT_TYPES.death)) return false;
  const birth = facts.find((f) => f.type === FACT_TYPES.birth);
  const year = yearOf(birth?.date?.formal ?? birth?.date?.original);
  if (!year) return person.living !== false;
  return now.getUTCFullYear() - Number(year) < LIVING_WINDOW_YEARS;
}

export function buildPlan(
  pid: string,
  findings: ProposedFinding[],
  doc: GedcomxDocument,
  options: PlanOptions = {}
): WritePlan {
  const plan: WritePlan = { pid, operations: [], skipped: [], dropped: [] };
  const person = doc.persons?.find((p) => p.id === pid);
  const now = (options.now ?? (() => new Date()))();
  if (!person) {
    plan.dropped.push({ findingId: "*", reason: `person ${pid} not in document` });
    return plan;
  }
  if (isPossiblyLiving(person, now)) {
    for (const f of findings) {
      plan.dropped.push({
        findingId: findingId(f),
        reason: "person is living or possibly living",
      });
    }
    return plan;
  }

  const minConfidence = options.minConfidence ?? 0.6;
  const accepted: ProposedFinding[] = [];
  for (const f of findings) {
    const id = findingId(f);
    if (!f.trmSourceId?.trim() || !f.trmFactId?.trim()) {
      plan.dropped.push({ findingId: id, reason: "missing TRM source id or fact id" });
    } else if (!f.sourceTitle?.trim() || !f.value?.trim()) {
      plan.dropped.push({ findingId: id, reason: "missing source title or value" });
    } else if (f.confidence < minConfidence) {
      plan.dropped.push({
        findingId: id,
        reason: `confidence ${f.confidence} below ${minConfidence}`,
      });
    } else {
      accepted.push(f);
    }
  }

  const noteTexts = (person.notes ?? []).map((n) => n.text ?? "");
  const attachedIds = new Set(
    (person.sources ?? []).map((s) => descriptionIdOf(s.description ?? s.descriptionId))
  );

  const sdOps: PlannedOperation[] = [];
  const attachOps: PlannedOperation[] = [];
  const noteOps: PlannedOperation[] = [];
  const factOps: PlannedOperation[] = [];
  const seq = { n: 0 };
  const nextId = () => `op-${++seq.n}`;

  const bySource = new Map<string, ProposedFinding[]>();
  for (const f of accepted) {
    const key = `${f.trmSourceId}|${f.sourceUrl ?? ""}`;
    bySource.set(key, [...(bySource.get(key) ?? []), f]);
  }

  for (const group of bySource.values()) {
    const first = group[0];
    const about = first.sourceUrl;
    const ids = group.map(findingId);
    const existingId = findDescription(doc, about, sourceMarker(first))?.id;
    const tags = group
      .map((f) => FACT_TYPES[f.kind])
      .filter((t): t is string => !!t);
    const message = `TRM ${first.trmSourceId}: ${first.sourceTitle}`.slice(0, 400);
    const confidence = Math.max(...group.map((f) => f.confidence));

    let sdOpId: string | undefined;
    if (existingId) {
      plan.skipped.push({
        findingId: ids[0],
        operation: "create_source_description",
        reason: `source description ${existingId} already present`,
      });
    } else {
      sdOpId = nextId();
      sdOps.push({
        id: sdOpId,
        type: "create_source_description",
        rationale: `Cite TRM source ${first.trmSourceId} so findings are traceable`,
        evidenceUrl: about,
        confidence,
        findingIds: ids,
        dedupe: { kind: "source", about, marker: sourceMarker(first) },
        changeMessage: message,
        method: "POST",
        path: SD_PATH,
        body: {
          sourceDescriptions: [
            {
              ...(about ? { about } : {}),
              titles: [{ value: first.sourceTitle }],
              citations: [{ value: citationText(first) }],
              notes: [{ text: `${sourceMarker(first)} ${group.map((f) => f.note).join("\n")}` }],
            },
          ],
        },
      });
    }

    if (existingId && attachedIds.has(existingId)) {
      plan.skipped.push({
        findingId: ids[0],
        operation: "attach_source",
        reason: `source ${existingId} already attached to ${pid}`,
      });
    } else {
      attachOps.push({
        id: nextId(),
        type: "attach_source",
        rationale: `Attach TRM source ${first.trmSourceId} to ${pid}`,
        evidenceUrl: about,
        confidence,
        findingIds: ids,
        dedupe: { kind: "attachment", about, marker: sourceMarker(first) },
        dependsOn: sdOpId,
        existingDescriptionId: existingId,
        changeMessage: message,
        method: "POST",
        path: personPath(pid),
        body: {
          persons: [
            {
              sources: [
                {
                  attribution: { changeMessage: message },
                  description: sdOpId ? `@op:${sdOpId}` : `@sd:${existingId}`,
                  ...(tags.length
                    ? { tags: [...new Set(tags)].map((resource) => ({ resource })) }
                    : {}),
                },
              ],
            },
          ],
        },
      });
    }
  }

  for (const f of accepted) {
    const id = findingId(f);
    const status = factStatus(person, f);

    if (status === "present") {
      plan.skipped.push({ findingId: id, operation: "add_note", reason: "already present as a conclusion" });
      continue;
    }

    if (noteTexts.some((t) => t.includes(marker(f)))) {
      plan.skipped.push({ findingId: id, operation: "add_note", reason: "note already present" });
    } else {
      const message = changeMessage(f, status);
      noteOps.push({
        id: nextId(),
        type: "add_note",
        rationale: noteRationale(f, status),
        evidenceUrl: f.sourceUrl,
        confidence: f.confidence,
        findingIds: [id],
        dedupe: { kind: "note", marker: marker(f) },
        changeMessage: message,
        method: "POST",
        path: `${personPath(pid)}/notes`,
        body: {
          persons: [
            {
              id: pid,
              attribution: { changeMessage: message },
              notes: [{ subject: noteSubject(f), text: noteText(f, status) }],
            },
          ],
        },
      });
    }

    if (status !== "absent") continue;
    if (!options.allowConclusions) {
      plan.skipped.push({
        findingId: id,
        operation: f.kind === "name_variant" ? "add_name" : "add_fact",
        reason: "conclusion writes disabled; recorded as note only",
      });
      continue;
    }
    const op = conclusionOp(pid, f, nextId());
    if (op) factOps.push(op);
  }

  plan.operations = [...sdOps, ...attachOps, ...noteOps, ...factOps];
  return plan;
}

type FactStatus = "present" | "absent" | "conflict" | "note_only";

function factStatus(person: GxPerson, f: ProposedFinding): FactStatus {
  if (f.kind === "name_variant") {
    const wanted = norm(f.value);
    const has = (person.names ?? []).some((n) =>
      (n.nameForms ?? []).some((form) => norm(form.fullText) === wanted)
    );
    return has ? "present" : "absent";
  }
  const factType = FACT_TYPES[f.kind];
  if (!factType) return "note_only";
  if (!f.date && !f.place) return "note_only";
  const same = (person.facts ?? []).filter((x) => x.type === factType);
  const matches = same.some((x) => factMatches(x, f));
  if (matches) return "present";
  if (same.length > 0 && UNIQUE_FACTS.has(f.kind)) return "conflict";
  return "absent";
}

function factMatches(existing: GxFact, f: ProposedFinding): boolean {
  const existingYear = yearOf(existing.date?.formal ?? existing.date?.original);
  const wantedYear = yearOf(f.date);
  const dateOk = !wantedYear || existingYear === wantedYear;
  const placeOk =
    !f.place || norm(existing.place?.original).includes(norm(f.place).split(" ")[0]);
  return dateOk && placeOk;
}

function conclusionOp(
  pid: string,
  f: ProposedFinding,
  id: string
): PlannedOperation | undefined {
  const message = changeMessage(f, "absent");
  const base = {
    id,
    rationale: `Add ${f.kind} conclusion backed by TRM source ${f.trmSourceId}`,
    evidenceUrl: f.sourceUrl,
    confidence: f.confidence,
    findingIds: [findingId(f)],
    changeMessage: message,
    method: "POST" as const,
    path: personPath(pid),
  };
  if (f.kind === "name_variant") {
    return {
      ...base,
      type: "add_name",
      dedupe: { kind: "name", fullText: f.value },
      body: {
        persons: [
          {
            id: pid,
            names: [
              {
                type: `${GX}AlsoKnownAs`,
                attribution: { changeMessage: message },
                nameForms: [{ fullText: f.value }],
              },
            ],
          },
        ],
      },
    };
  }
  const factType = FACT_TYPES[f.kind];
  if (!factType) return undefined;
  return {
    ...base,
    type: "add_fact",
    dedupe: {
      kind: "fact",
      factType,
      year: yearOf(f.date),
      place: f.place,
    },
    body: {
      persons: [
        {
          id: pid,
          facts: [
            {
              attribution: { changeMessage: message },
              type: factType,
              ...(f.date ? { date: { original: f.date } } : {}),
              ...(f.place ? { place: { original: f.place } } : {}),
            },
          ],
        },
      ],
    },
  };
}

const KIND_LABEL: Record<FindingKind, string> = {
  name_variant: "Name variant",
  birth: "Birth",
  death: "Death",
  marriage: "Marriage",
  residence: "Residence",
  relationship: "Relationship",
};

function noteSubject(f: ProposedFinding): string {
  return `TRM research: ${KIND_LABEL[f.kind]}`;
}

function noteText(f: ProposedFinding, status: FactStatus): string {
  const parts = [`${KIND_LABEL[f.kind]}: ${f.value}`];
  if (f.date) parts.push(`Date: ${f.date}`);
  if (f.place) parts.push(`Place: ${f.place}`);
  parts.push(`Source: ${f.sourceTitle}${f.sourceUrl ? ` (${f.sourceUrl})` : ""}`);
  if (status === "conflict") parts.push("Differs from the existing conclusion; offered for review, not applied.");
  parts.push(f.note, marker(f));
  return parts.join("\n");
}

function noteRationale(f: ProposedFinding, status: FactStatus): string {
  if (status === "conflict") return `${f.kind} differs from the existing conclusion; record as a note only`;
  if (status === "note_only") return `${f.kind} cannot be written as a person conclusion; record as a note`;
  return `Record ${f.kind} finding with its evidence`;
}

function changeMessage(f: ProposedFinding, status: FactStatus): string {
  const base = `TRM research ${findingId(f)}: ${KIND_LABEL[f.kind]} from ${f.sourceTitle}`;
  return (status === "conflict" ? `${base} (differs from existing)` : base).slice(0, 400);
}

function citationText(f: ProposedFinding): string {
  return f.sourceUrl ? `${f.sourceTitle}, ${f.sourceUrl}` : f.sourceTitle;
}

export function descriptionIdOf(ref?: string): string {
  if (!ref) return "";
  const clean = ref.split(/[?#]/)[0] || ref.replace(/^#/, "");
  return clean.split("/").filter(Boolean).pop() ?? "";
}

export function findDescription(
  doc: GedcomxDocument,
  about: string | undefined,
  sourceMarker: string
): GxSourceDescription | undefined {
  return (doc.sourceDescriptions ?? []).find(
    (sd) =>
      (about !== undefined && sd.about === about) ||
      (sd.notes ?? []).some((n) => n.text?.includes(sourceMarker))
  );
}
