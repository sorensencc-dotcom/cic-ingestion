export const GEDCOMX_JSON = "application/x-gedcomx-v1+json";
export const GEDCOMX_ATOM_JSON = "application/x-gedcomx-atom+json";

export interface GxDate {
  original?: string;
  formal?: string;
}

export interface GxPlace {
  original?: string;
}

export interface GxFact {
  type?: string;
  date?: GxDate;
  place?: GxPlace;
}

export interface GxName {
  type?: string;
  preferred?: boolean;
  nameForms?: Array<{ fullText?: string }>;
}

export interface GxPerson {
  id: string;
  gender?: { type?: string };
  names?: GxName[];
  facts?: GxFact[];
  living?: boolean;
  display?: {
    name?: string;
    gender?: string;
    lifespan?: string;
    birthDate?: string;
    birthPlace?: string;
    deathDate?: string;
    deathPlace?: string;
  };
}

export interface GxResourceRef {
  resource?: string;
  resourceId?: string;
}

export interface GxRelationship {
  id?: string;
  type?: string;
  person1?: GxResourceRef;
  person2?: GxResourceRef;
  facts?: GxFact[];
}

export interface GxSourceDescription {
  id?: string;
  about?: string;
  titles?: Array<{ value?: string }>;
}

export interface GedcomxDocument {
  persons?: GxPerson[];
  relationships?: GxRelationship[];
  sourceDescriptions?: GxSourceDescription[];
}

export interface GxAtomEntry {
  id?: string;
  title?: string;
  score?: number;
  confidence?: number;
  content?: { gedcomx?: GedcomxDocument };
}

export interface GxAtomFeed {
  results?: number;
  index?: number;
  entries?: GxAtomEntry[];
  links?: { next?: { href?: string } };
}

export interface PersonTree {
  pid: string;
  name: string;
  lifespan: {
    birth?: { date?: string; place?: string };
    death?: { date?: string; place?: string };
  };
}

export interface Couple {
  relationshipId: string;
  husband?: PersonTree;
  wife?: PersonTree;
  children: PersonTree[];
  married?: { date?: string; place?: string };
}

export interface FamilySearchSource {
  id: string;
  title: string;
  url: string;
}

export interface FamilySearchResponse {
  persons: PersonTree[];
  relationships: Couple[];
  sources: FamilySearchSource[];
  raw: GedcomxDocument;
}

export interface SearchHit {
  pid: string;
  score: number;
  person: PersonTree;
  raw: GxAtomEntry;
}

export interface SearchResult {
  total: number;
  offset: number;
  nextOffset?: number;
  hits: SearchHit[];
  raw: GxAtomFeed;
}

export interface SearchParams {
  givenName?: string;
  surname?: string;
  sex?: "Male" | "Female";
  birthLikeDate?: string;
  birthLikePlace?: string;
  deathLikeDate?: string;
  deathLikePlace?: string;
  offset?: number;
  count?: number;
}

export function validateGedcomxPersonDocument(data: unknown): GedcomxDocument {
  if (!data || typeof data !== "object") {
    throw new Error("Response is not an object");
  }
  const doc = data as GedcomxDocument;
  if (!Array.isArray(doc.persons) || doc.persons.length === 0) {
    throw new Error("Missing or empty persons array");
  }
  for (const person of doc.persons) {
    if (!person || typeof person.id !== "string" || !person.id) {
      throw new Error("Person missing required field: id");
    }
  }
  if (doc.relationships !== undefined && !Array.isArray(doc.relationships)) {
    throw new Error("Invalid relationships array");
  }
  return doc;
}

export function validateAtomFeed(data: unknown): GxAtomFeed {
  if (!data || typeof data !== "object") {
    throw new Error("Search response is not an object");
  }
  const feed = data as GxAtomFeed;
  if (feed.entries !== undefined && !Array.isArray(feed.entries)) {
    throw new Error("Invalid entries array");
  }
  return feed;
}
