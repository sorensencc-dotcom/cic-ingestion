import {
  Couple,
  FamilySearchResponse,
  GedcomxDocument,
  GxAtomEntry,
  GxAtomFeed,
  GxFact,
  GxPerson,
  GxRelationship,
  PersonTree,
  SearchHit,
  SearchResult,
} from "./schema";

const FACT_BIRTH = "http://gedcomx.org/Birth";
const FACT_DEATH = "http://gedcomx.org/Death";
const FACT_MARRIAGE = "http://gedcomx.org/Marriage";
const REL_COUPLE = "http://gedcomx.org/Couple";
const REL_PARENT_CHILD = "http://gedcomx.org/ParentChild";
const GENDER_MALE = "http://gedcomx.org/Male";
const GENDER_FEMALE = "http://gedcomx.org/Female";

function findFact(facts: GxFact[] | undefined, type: string): GxFact | undefined {
  return facts?.find((f) => f.type === type);
}

function eventOf(
  fact: GxFact | undefined,
  displayDate?: string,
  displayPlace?: string
): { date?: string; place?: string } | undefined {
  const date = fact?.date?.original ?? displayDate;
  const place = fact?.place?.original ?? displayPlace;
  return date || place ? { date, place } : undefined;
}

function personName(person: GxPerson): string {
  const names = person.names ?? [];
  const preferred = names.find((n) => n.preferred) ?? names[0];
  return (
    preferred?.nameForms?.[0]?.fullText ??
    person.display?.name ??
    ""
  );
}

export function mapPerson(person: GxPerson): PersonTree {
  const birth = eventOf(
    findFact(person.facts, FACT_BIRTH),
    person.display?.birthDate,
    person.display?.birthPlace
  );
  const death = eventOf(
    findFact(person.facts, FACT_DEATH),
    person.display?.deathDate,
    person.display?.deathPlace
  );
  return {
    pid: person.id,
    name: personName(person),
    lifespan: {
      ...(birth ? { birth } : {}),
      ...(death ? { death } : {}),
    },
  };
}

function refId(ref: { resourceId?: string; resource?: string } | undefined): string | undefined {
  return ref?.resourceId ?? ref?.resource?.replace(/^#/, "");
}

function pairKey(rel: GxRelationship): string {
  return `${refId(rel.person1) ?? "?"}-${refId(rel.person2) ?? "?"}`;
}

export function mapDocument(doc: GedcomxDocument): FamilySearchResponse {
  const gxPersons = doc.persons ?? [];
  const byId = new Map(gxPersons.map((p) => [p.id, p]));
  const trees = new Map(gxPersons.map((p) => [p.id, mapPerson(p)]));
  const relationships = doc.relationships ?? [];

  const couples: Couple[] = relationships
    .filter((r) => r.type === REL_COUPLE)
    .map((rel) => {
      const id1 = refId(rel.person1);
      const id2 = refId(rel.person2);
      const gender = (id?: string) =>
        id ? byId.get(id)?.gender?.type : undefined;
      let husbandId = id1;
      let wifeId = id2;
      if (
        gender(id1) === GENDER_FEMALE ||
        gender(id2) === GENDER_MALE
      ) {
        husbandId = id2;
        wifeId = id1;
      }
      const children = relationships
        .filter(
          (r) =>
            r.type === REL_PARENT_CHILD &&
            (refId(r.person1) === id1 || refId(r.person1) === id2)
        )
        .map((r) => trees.get(refId(r.person2) ?? ""))
        .filter((c): c is PersonTree => c !== undefined)
        .filter((c, i, all) => all.findIndex((o) => o.pid === c.pid) === i);
      const marriage = eventOf(findFact(rel.facts, FACT_MARRIAGE));
      return {
        relationshipId: rel.id ?? pairKey(rel),
        husband: husbandId ? trees.get(husbandId) : undefined,
        wife: wifeId ? trees.get(wifeId) : undefined,
        children,
        ...(marriage ? { married: marriage } : {}),
      };
    });

  return {
    persons: [...trees.values()],
    relationships: couples,
    sources: (doc.sourceDescriptions ?? []).map((s) => ({
      id: s.id ?? "",
      title: s.titles?.[0]?.value ?? "",
      url: s.about ?? "",
    })),
    raw: doc,
  };
}

function entryPerson(entry: GxAtomEntry): GxPerson | undefined {
  const persons = entry.content?.gedcomx?.persons ?? [];
  return persons.find((p) => p.id === entry.id) ?? persons[0];
}

export function mapSearchFeed(feed: GxAtomFeed, offset: number): SearchResult {
  const hits: SearchHit[] = [];
  for (const entry of feed.entries ?? []) {
    const person = entryPerson(entry);
    if (!person) continue;
    hits.push({
      pid: person.id,
      score: typeof entry.score === "number" ? entry.score : 0,
      person: mapPerson(person),
      raw: entry,
    });
  }
  hits.sort((a, b) => b.score - a.score);

  const total = typeof feed.results === "number" ? feed.results : hits.length;
  const consumed = offset + (feed.entries?.length ?? 0);
  return {
    total,
    offset,
    nextOffset: consumed < total ? consumed : undefined,
    hits,
    raw: feed,
  };
}
