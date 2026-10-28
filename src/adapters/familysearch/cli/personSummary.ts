import { GedcomxDocument, GxFact, GxPerson } from "../schema";

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = /token|secret|authorization|password|email|phone|address/i.test(k)
        ? "[REDACTED]"
        : redactSecrets(v);
    }
    return out;
  }
  return value;
}

const shortType = (t?: string): string => (t ? (t.split("/").pop() ?? t) : "unknown");

function formatFact(f: GxFact): string {
  const parts = [shortType(f.type)];
  const date = f.date?.original ?? f.date?.formal;
  if (date) parts.push(date);
  if (f.place?.original) parts.push(f.place.original);
  return parts.join(" | ");
}

export function findFocusPerson(doc: GedcomxDocument, pid: string): GxPerson {
  const persons = doc.persons ?? [];
  const person = persons.find((p) => p.id === pid) ?? persons[0];
  if (!person) throw new Error("No person in document");
  return person;
}

export function formatPersonSummary(doc: GedcomxDocument, pid: string): string {
  const person = findFocusPerson(doc, pid);
  const lines: string[] = [];
  lines.push(`Person ${person.id}${person.living ? " (living)" : ""}`);

  const names = (person.names ?? [])
    .map((n) => n.nameForms?.[0]?.fullText)
    .filter((n): n is string => Boolean(n));
  lines.push(`Names: ${names.length ? names.join("; ") : "(none)"}`);

  const facts = person.facts ?? [];
  lines.push(`Facts (${facts.length}):`);
  for (const f of facts) lines.push(`  - ${formatFact(f)}`);

  const descs = doc.sourceDescriptions ?? [];
  lines.push(`Source descriptions (${descs.length}):`);
  for (const d of descs) {
    lines.push(`  - ${d.titles?.[0]?.value ?? "(untitled)"}${d.about ? ` <${d.about}>` : ""}`);
  }

  const notes = person.notes ?? [];
  lines.push(`Notes (${notes.length}):`);
  for (const n of notes) {
    const text = (n.text ?? "").replace(/\s+/g, " ").slice(0, 120);
    lines.push(`  - ${n.subject ? `${n.subject}: ` : ""}${text}`);
  }

  const relatives = new Set<string>();
  for (const r of doc.relationships ?? []) {
    for (const ref of [r.person1, r.person2]) {
      const id = ref?.resourceId;
      if (id && id !== person.id) relatives.add(id);
    }
  }
  lines.push(`Relatives: ${relatives.size}`);
  return lines.join("\n");
}
