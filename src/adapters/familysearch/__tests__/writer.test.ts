import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import nock from "nock";
import { FamilySearchAdapter } from "../FamilySearchAdapter";
import { StaticTokenProvider } from "../tokenProvider";
import { GedcomxDocument } from "../schema";
import {
  WriteRefusedError,
  applyPlan,
} from "../writeApply";
import {
  ProposedFinding,
  WritePlan,
  buildPlan,
  fingerprint,
  planWrite,
} from "../writePlan";
import personFixture from "./fixtures/person.json";

const API = "https://apibeta.familysearch.org";
const PID = "KWCH-1AB";
const SOURCE_URL = "https://trm.example/records/42";

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const doc = () => clone(personFixture) as unknown as GedcomxDocument;

function finding(over: Partial<ProposedFinding> = {}): ProposedFinding {
  return {
    kind: "residence",
    value: "Lived in Salt Lake City",
    date: "1910",
    place: "Salt Lake City, Utah",
    sourceUrl: SOURCE_URL,
    sourceTitle: "1910 census extract",
    trmSourceId: "S-42",
    trmFactId: "F-1",
    confidence: 0.9,
    note: "Household of 6 on page 12.",
    ...over,
  };
}

function makeAdapter() {
  return new FamilySearchAdapter({
    name: "familysearch",
    version: "test",
    timeout: 2000,
    retries: 3,
    tokenProvider: new StaticTokenProvider("tok"),
    sleep: async () => {},
  });
}

function mockRead(d: object = personFixture) {
  nock(API).get(`/platform/tree/persons/${PID}`).query(true).reply(200, d);
  const notes = (d as GedcomxDocument).persons?.find((p) => p.id === PID)?.notes;
  nock(API)
    .get(`/platform/tree/persons/${PID}/notes`)
    .reply(200, { persons: [{ id: PID, notes: notes ?? [] }] });
}

beforeEach(() => nock.disableNetConnect());
afterEach(() => {
  expect(nock.pendingMocks()).toEqual([]);
  nock.cleanAll();
  nock.enableNetConnect();
});

describe("buildPlan", () => {
  it("plans source, attachment, and note first with no conclusion writes by default", () => {
    const plan = buildPlan(PID, [finding()], doc());
    expect(plan.operations.map((o) => o.type)).toEqual([
      "create_source_description",
      "attach_source",
      "add_note",
    ]);
    const [sd, attach, note] = plan.operations;
    expect(sd.body).toMatchObject({
      sourceDescriptions: [
        { about: SOURCE_URL, titles: [{ value: "1910 census extract" }] },
      ],
    });
    expect(attach.dependsOn).toBe(sd.id);
    expect(JSON.stringify(attach.body)).toContain(`@op:${sd.id}`);
    expect(note.path).toBe(`/platform/tree/persons/${PID}/notes`);
    expect(note.changeMessage).toContain("S-42/F-1");
    expect(plan.skipped.some((s) => s.reason.includes("recorded as note only"))).toBe(true);
  });

  it("adds a residence fact only when conclusions are enabled and never overwrites", () => {
    const plan = buildPlan(PID, [finding()], doc(), { allowConclusions: true });
    const fact = plan.operations.find((o) => o.type === "add_fact");
    expect(fact?.body).toMatchObject({
      persons: [{ facts: [{ type: "http://gedcomx.org/Residence", place: { original: "Salt Lake City, Utah" } }] }],
    });
    expect(plan.operations.every((o) => o.method === "POST")).toBe(true);
  });

  it("downgrades a conflicting birth to a note and skips an already-present death", () => {
    const plan = buildPlan(
      PID,
      [
        finding({ kind: "birth", date: "1851", place: "Leeds", trmFactId: "F-2" }),
        finding({ kind: "death", date: "1 Jan 1920", place: "Provo", trmFactId: "F-3" }),
      ],
      doc(),
      { allowConclusions: true }
    );
    expect(plan.operations.some((o) => o.type === "add_fact")).toBe(false);
    const notes = plan.operations.filter((o) => o.type === "add_note");
    expect(notes).toHaveLength(1);
    expect(notes[0].findingIds).toEqual(["S-42/F-2"]);
    expect(notes[0].rationale).toMatch(/differs/);
    expect(plan.skipped).toContainEqual(
      expect.objectContaining({ findingId: "S-42/F-3", reason: "already present as a conclusion" })
    );
  });

  it("treats a same-year death with a different day as a conflict, not as present", () => {
    const plan = buildPlan(
      PID,
      [finding({ kind: "death", date: "13 August 1920", place: "Provo", trmFactId: "F-4" })],
      doc(),
      { allowConclusions: true }
    );
    expect(plan.operations.some((o) => o.type === "add_fact")).toBe(false);
    const notes = plan.operations.filter((o) => o.type === "add_note");
    expect(notes).toHaveLength(1);
    expect(notes[0].rationale).toMatch(/differs/);
  });

  it("still treats a year-only or same-day death as present", () => {
    const plan = buildPlan(
      PID,
      [
        finding({ kind: "death", date: "1920", place: "Provo", trmFactId: "F-5" }),
        finding({ kind: "death", date: "1 January 1920", place: "Provo", trmFactId: "F-6" }),
      ],
      doc()
    );
    expect(plan.operations.some((o) => o.type === "add_note")).toBe(false);
    expect(plan.skipped.filter((s) => s.reason === "already present as a conclusion")).toHaveLength(2);
  });

  it("compares month-first and ISO dates by day too", () => {
    const run = (date: string, id: string) =>
      buildPlan(PID, [finding({ kind: "death", date, place: "Provo", trmFactId: id })], doc());
    expect(run("Jan 1, 1920", "F-7").operations.some((o) => o.type === "add_note")).toBe(false);
    expect(run("January 2, 1920", "F-8").operations.some((o) => o.type === "add_note")).toBe(true);
    expect(run("1920-01-02", "F-9").operations.some((o) => o.type === "add_note")).toBe(true);
  });

  it("does not treat a qualified date as proof the death is already present", () => {
    const plan = buildPlan(
      PID,
      [finding({ kind: "death", date: "about 5 March 1920", place: "Provo", trmFactId: "F-10" })],
      doc(),
      { allowConclusions: true }
    );
    expect(plan.operations.some((o) => o.type === "add_fact")).toBe(false);
    expect(plan.operations.some((o) => o.type === "add_note")).toBe(true);
  });

  it("does not treat an impossible calendar day as present", () => {
    const run = (date: string, id: string) =>
      buildPlan(PID, [finding({ kind: "death", date, place: "Provo", trmFactId: id })], doc());
    for (const [date, id] of [
      ["31 February 1920", "F-11"],
      ["Feb 30, 1920", "F-12"],
      ["1920-02-31", "F-13"],
      ["1920-13-01", "F-14"],
      ["0 January 1920", "F-15"],
      ["29 February 1920", "F-16"],
    ]) {
      expect(run(date, id).operations.some((o) => o.type === "add_note")).toBe(true);
    }
  });

  it("treats a unique fact with an unparsed date format as a conflict, never as present", () => {
    const run = (date: string, id: string, extra: Partial<ProposedFinding> = {}) =>
      buildPlan(
        PID,
        [finding({ kind: "death", date, place: "Provo", trmFactId: id, ...extra })],
        doc(),
        { allowConclusions: true }
      );
    for (const [date, id] of [
      ["2-Jan-1920", "F-17"],
      ["1/1/1920", "F-18"],
      ["1 Jan", "F-19"],
      ["January 1920", "F-20"],
      ["1. Januar 1920", "F-21"],
      ["1 maj 1920", "F-22"],
    ]) {
      const plan = run(date, id);
      expect(plan.operations.some((o) => o.type === "add_fact")).toBe(false);
      expect(plan.operations.some((o) => o.type === "add_note")).toBe(true);
    }
  });

  it("plans only one death per batch and leaves a second, different one as a note", () => {
    const base = { kind: "death" as const, place: "Reno, Nevada" };
    const plan = buildPlan(
      PID,
      [
        finding({ ...base, date: "13 August 1968", trmFactId: "F-30" }),
        finding({ ...base, date: "11 August 1968", trmFactId: "F-31" }),
      ],
      {
        ...doc(),
        persons: [
          {
            ...doc().persons![0],
            facts: doc().persons![0].facts!.filter((x) => x.type?.endsWith("Birth")),
          },
        ],
      } as GedcomxDocument,
      { allowConclusions: true }
    );
    expect(plan.operations.filter((o) => o.type === "add_fact")).toHaveLength(1);
    expect(plan.operations.filter((o) => o.type === "add_note")).toHaveLength(2);
    expect(plan.skipped).toContainEqual(
      expect.objectContaining({ findingId: "S-42/F-31", operation: "add_fact" })
    );
  });

  it("finds an inlined source description by title when it has no marker note", () => {
    const d = doc();
    d.sourceDescriptions = [{ id: "ABCD-123", titles: [{ value: "1910 Census Extract" }] }];
    const plan = buildPlan(PID, [finding({ sourceUrl: undefined })], d);
    expect(plan.operations.some((o) => o.type === "create_source_description")).toBe(false);
    expect(plan.operations.find((o) => o.type === "attach_source")?.existingDescriptionId).toBe(
      "ABCD-123"
    );
  });

  it("uses the fingerprint as the op id, stable when the plan is rebuilt", () => {
    const a = finding({ kind: "residence", trmFactId: "F-40" });
    const b = finding({ kind: "residence", trmFactId: "F-41", place: "Ogden, Utah" });
    const first = buildPlan(PID, [a, b], doc(), { allowConclusions: true });
    const second = buildPlan(PID, [b], doc(), { allowConclusions: true });
    for (const op of first.operations) expect(op.id).toBe(fingerprint(op));
    expect(new Set(first.operations.map((o) => o.id)).size).toBe(first.operations.length);
    const noteOf = (p: WritePlan, id: string) =>
      p.operations.find((o) => o.type === "add_note" && o.findingIds[0] === id)?.id;
    expect(noteOf(second, "S-42/F-41")).toBe(noteOf(first, "S-42/F-41"));
  });

  it("does not match places that only share a first word", () => {
    const run = (place: string, id: string) =>
      buildPlan(PID, [finding({ kind: "death", date: "1920", place, trmFactId: id })], doc());
    expect(run("Provo", "F-32").operations.some((o) => o.type === "add_note")).toBe(false);
    expect(run("Provo, Utah", "F-33").operations.some((o) => o.type === "add_note")).toBe(false);
    expect(run("Provo, Ohio", "F-34").operations.some((o) => o.type === "add_note")).toBe(true);
    expect(run("Pro", "F-35").operations.some((o) => o.type === "add_note")).toBe(true);
  });

  it("still treats identical text or an equal exact day as present for a unique fact", () => {
    const run = (date: string, id: string) =>
      buildPlan(PID, [finding({ kind: "death", date, place: "Provo", trmFactId: id })], doc());
    for (const [date, id] of [
      ["1 January 1920", "F-23"],
      ["Jan 1, 1920", "F-24"],
      ["1920-01-01", "F-25"],
      ["1920", "F-26"],
    ]) {
      expect(run(date, id).operations.some((o) => o.type === "add_note")).toBe(false);
    }
  });

  it("reuses an existing source description and skips an existing attachment", () => {
    const d = doc();
    d.sourceDescriptions!.push({ id: "SD-9", about: SOURCE_URL, titles: [{ value: "x" }] });
    d.persons![0].sources = [{ description: "https://api.familysearch.org/platform/sources/descriptions/SD-9" }];
    const plan = buildPlan(PID, [finding()], d);
    expect(plan.operations.map((o) => o.type)).toEqual(["add_note"]);
    expect(plan.skipped.map((s) => s.operation)).toEqual(
      expect.arrayContaining(["create_source_description", "attach_source"])
    );
  });

  it("attaches an existing source description that is not yet attached", () => {
    const d = doc();
    d.sourceDescriptions!.push({ id: "SD-9", about: SOURCE_URL });
    const plan = buildPlan(PID, [finding()], d);
    const attach = plan.operations.find((o) => o.type === "attach_source");
    expect(attach?.existingDescriptionId).toBe("SD-9");
    expect(attach?.dependsOn).toBeUndefined();
  });

  it("skips a note whose TRM marker already exists", () => {
    const d = doc();
    d.persons![0].notes = [{ text: "earlier\n[TRM:S-42/F-1]" }];
    const plan = buildPlan(PID, [finding()], d);
    expect(plan.operations.some((o) => o.type === "add_note")).toBe(false);
    expect(plan.skipped).toContainEqual(
      expect.objectContaining({ reason: "note already present" })
    );
  });

  it("drops findings without TRM ids or below the confidence floor", () => {
    const plan = buildPlan(
      PID,
      [
        finding({ trmSourceId: "" }),
        finding({ trmFactId: "F-low", confidence: 0.2 }),
      ],
      doc()
    );
    expect(plan.operations).toEqual([]);
    expect(plan.dropped).toHaveLength(2);
  });

  it("drops everything for a living person", () => {
    const d = doc();
    d.persons![0].living = true;
    const plan = buildPlan(PID, [finding()], d);
    expect(plan.operations).toEqual([]);
    expect(plan.dropped[0].reason).toMatch(/living/);
  });

  it("treats a person with no death and a recent birth as possibly living", () => {
    const d = doc();
    d.persons![0].facts = [{ type: "http://gedcomx.org/Birth", date: { original: "1960" } }];
    const plan = buildPlan(PID, [finding()], d, { now: () => new Date("2026-10-28") });
    expect(plan.dropped).toHaveLength(1);
  });

  it("records relationship findings as notes only", () => {
    const plan = buildPlan(
      PID,
      [finding({ kind: "relationship", value: "Father of Charles", date: undefined, place: undefined })],
      doc(),
      { allowConclusions: true }
    );
    expect(plan.operations.map((o) => o.type)).toEqual([
      "create_source_description",
      "attach_source",
      "add_note",
    ]);
  });

  it("adds an AlsoKnownAs name only when absent", () => {
    const plan = buildPlan(
      PID,
      [
        finding({ kind: "name_variant", value: "Jon Smyth", date: undefined, place: undefined }),
        finding({ kind: "name_variant", value: "john smith", date: undefined, place: undefined, trmFactId: "F-9" }),
      ],
      doc(),
      { allowConclusions: true }
    );
    const names = plan.operations.filter((o) => o.type === "add_name");
    expect(names).toHaveLength(1);
    expect(JSON.stringify(names[0].body)).toContain("AlsoKnownAs");
  });
});

describe("planWrite", () => {
  it("reads the person through the adapter and performs no write", async () => {
    mockRead(personFixture);
    const plan = await planWrite(PID, [finding()], makeAdapter());
    expect(plan.operations).toHaveLength(3);
  });
});

describe("applyPlan", () => {
  const confirmAll = async () => true;
  const planFor = (findings = [finding()], d = doc()): WritePlan => buildPlan(PID, findings, d);
  const base = (over: Record<string, unknown> = {}) => ({
    confirm: true as const,
    findings: [finding()],
    env: { FAMILYSEARCH_ENV: "beta" } as NodeJS.ProcessEnv,
    writer: makeAdapter(),
    confirmOperation: confirmAll,
    sourceDescriptionsVerified: true,
    sleep: async () => {},
    ...over,
  });

  it("refuses without confirm, without a callback, and outside beta", async () => {
    await expect(
      applyPlan(planFor(), base({ sourceDescriptionsVerified: undefined }))
    ).rejects.toThrow(/source description.*unverified/);
    await expect(applyPlan(planFor(), base({ confirm: false }))).rejects.toThrow(WriteRefusedError);
    await expect(applyPlan(planFor(), base({ confirmOperation: undefined }))).rejects.toThrow(/confirmOperation/);
    await expect(applyPlan(planFor(), base({ env: {} }))).rejects.toThrow(/FAMILYSEARCH_ENV=beta/);
    await expect(
      applyPlan(planFor(), base({ env: { FAMILYSEARCH_ENV: "production" } }))
    ).rejects.toThrow(WriteRefusedError);
  });

  it("refuses a production adapter unless production writes are enabled", async () => {
    const prod = new FamilySearchAdapter({
      name: "familysearch", version: "t", timeout: 1000, retries: 1,
      env: "production", tokenProvider: new StaticTokenProvider("tok"),
    });
    await expect(
      applyPlan(planFor(), base({ writer: prod, env: { FAMILYSEARCH_ENV: "beta" } }))
    ).rejects.toThrow(/PRODUCTION_WRITES/);
  });

  it("posts source, attachment, and note in order, wiring the new source id", async () => {
    mockRead(personFixture);
    let sdBody: any;
    let attachBody: any;
    let noteBody: any;
    nock(API)
      .post("/platform/sources/descriptions", (b) => ((sdBody = b), true))
      .matchHeader("content-type", /application\/x-gedcomx-v1\+json/)
      .matchHeader("authorization", "Bearer tok")
      .reply(201, "", { "X-Entity-Id": "QDS-NEW", Location: `${API}/platform/sources/descriptions/QDS-NEW` });
    nock(API)
      .post(`/platform/tree/persons/${PID}`, (b) => ((attachBody = b), true))
      .reply(201, "", { "X-Entity-Id": "SRSR-1" });
    nock(API)
      .post(`/platform/tree/persons/${PID}/notes`, (b) => ((noteBody = b), true))
      .reply(201, "", { "X-Entity-Id": "7" });

    const results = await applyPlan(planFor(), base());
    expect(results.map((r) => r.status)).toEqual(["posted", "posted", "posted"]);
    expect(sdBody.sourceDescriptions[0].about).toBe(SOURCE_URL);
    expect(attachBody.persons[0].sources[0].description).toBe(`${API}/platform/sources/descriptions/QDS-NEW`);
    expect(attachBody.persons[0].sources[0].attribution.changeMessage).toContain("S-42");
    expect(noteBody.persons[0].attribution.changeMessage).toContain("S-42/F-1");
    expect(noteBody.persons[0].notes[0].text).toContain("[TRM:S-42/F-1]");
  });

  it("is idempotent: re-applying against a tree that already has everything posts nothing", async () => {
    const plan = planFor();
    const d = doc();
    d.sourceDescriptions!.push({ id: "SD-N", about: SOURCE_URL });
    d.persons![0].sources = [{ description: `${API}/platform/sources/descriptions/SD-N` }];
    d.persons![0].notes = [{ text: "[TRM:S-42/F-1]" }];
    mockRead(d);
    const results = await applyPlan(plan, base());
    expect(results.map((r) => r.status)).toEqual(["already_present", "already_present", "already_present"]);
  });

  it("reuses an existing source description found at apply time for the attachment", async () => {
    const d = doc();
    d.sourceDescriptions!.push({ id: "SD-N", about: SOURCE_URL });
    mockRead(d);
    let attachBody: any;
    nock(API).post(`/platform/tree/persons/${PID}`, (b) => ((attachBody = b), true)).reply(201);
    nock(API).post(`/platform/tree/persons/${PID}/notes`).reply(201);
    const results = await applyPlan(planFor(), base());
    expect(results.map((r) => r.status)).toEqual(["already_present", "posted", "posted"]);
    expect(attachBody.persons[0].sources[0].description).toBe(`${API}/platform/sources/descriptions/SD-N`);
  });

  it("attaches a declared existing source description instead of creating one", async () => {
    const existingSources = { "S-42": "71FD-WWJ" };
    const plan = buildPlan(PID, [finding()], doc(), { existingSources });
    expect(plan.operations.map((o) => o.type)).toEqual(["attach_source", "add_note"]);
    expect(plan.operations[0].dependsOn).toBeUndefined();
    expect(plan.skipped.map((s) => s.operation)).toContain("create_source_description");

    mockRead(personFixture);
    let attachBody: any;
    nock(API).post(`/platform/tree/persons/${PID}`, (b) => ((attachBody = b), true)).reply(201);
    const results = await applyPlan(
      plan,
      base({
        planOptions: { existingSources },
        confirmOperation: async (op: { type: string }) => op.type === "attach_source",
      })
    );
    expect(results.map((r) => r.status)).toEqual(["posted", "declined"]);
    expect(attachBody.persons[0].sources[0].description).toBe(
      `${API}/platform/sources/descriptions/71FD-WWJ`
    );
  });

  it("skips the attachment when the declared source description is already attached", () => {
    const d = doc();
    d.persons![0].sources = [{ description: `${API}/platform/sources/descriptions/71FD-WWJ` }];
    const plan = buildPlan(PID, [finding()], d, { existingSources: { "S-42": "71FD-WWJ" } });
    expect(plan.operations.map((o) => o.type)).toEqual(["add_note"]);
    expect(plan.skipped.map((s) => s.operation)).toEqual(
      expect.arrayContaining(["create_source_description", "attach_source"])
    );
  });

  it("rejects a malformed declared source description id", () => {
    for (const id of ["", "x", "../../persons", "AB CD", "71FD-WWJ?x=1"]) {
      expect(() => buildPlan(PID, [finding()], doc(), { existingSources: { "S-42": id } })).toThrow(
        /invalid existing source description id/
      );
    }
  });

  it("skips declined operations and their dependents", async () => {
    mockRead(personFixture);
    nock(API).post(`/platform/tree/persons/${PID}/notes`).reply(201);
    const results = await applyPlan(
      planFor(),
      base({ confirmOperation: async (op: { type: string }) => op.type === "add_note" })
    );
    expect(results.map((r) => r.status)).toEqual(["declined", "declined", "posted"]);
  });

  it("stops after a failed post and never retries it", async () => {
    mockRead(personFixture);
    nock(API).post("/platform/sources/descriptions").reply(500);
    const results = await applyPlan(planFor(), base());
    expect(results.map((r) => r.status)).toEqual(["failed", "not_run", "not_run"]);
    expect(results[0].error).toMatch(/HTTP 500/);
  });

  it("honors Retry-After on 429 and rate limits between posts", async () => {
    mockRead(personFixture);
    nock(API).post("/platform/sources/descriptions").reply(429, "", { "Retry-After": "1" });
    nock(API).post("/platform/sources/descriptions").reply(201, "", { "X-Entity-Id": "QDS-2" });
    nock(API).post(`/platform/tree/persons/${PID}`).reply(201);
    nock(API).post(`/platform/tree/persons/${PID}/notes`).reply(201);
    const sleep = jest.fn(async (_ms: number) => {});
    let clock = 0;
    const results = await applyPlan(
      planFor(),
      base({ sleep, now: () => (clock += 100), minIntervalMs: 1500 })
    );
    expect(results.map((r) => r.status)).toEqual(["posted", "posted", "posted"]);
    const waits = sleep.mock.calls.map((c) => c[0]);
    expect(waits.filter((ms) => ms >= 1000).length).toBeGreaterThanOrEqual(2);
  });
});

describe("fail-closed findings", () => {
  it.each([
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["string", "high"],
    ["above 1", 7],
  ])("drops a finding whose confidence is %s", (_label, confidence) => {
    const plan = buildPlan(
      PID,
      [finding({ confidence: confidence as unknown as number })],
      doc()
    );
    expect(plan.operations).toEqual([]);
    expect(plan.dropped[0].reason).toMatch(/confidence/);
  });

  it("drops non-string ids and unknown kinds instead of throwing", () => {
    const plan = buildPlan(
      PID,
      [
        finding({ trmSourceId: 42 as unknown as string }),
        finding({ kind: "bogus" as never, trmFactId: "F-5" }),
      ],
      doc()
    );
    expect(plan.operations).toEqual([]);
    expect(plan.dropped).toHaveLength(2);
  });

  it("drops a duplicate finding id within one batch", () => {
    const plan = buildPlan(PID, [finding(), finding()], doc());
    expect(plan.operations.filter((o) => o.type === "add_note")).toHaveLength(1);
    expect(plan.dropped[0].reason).toMatch(/duplicate/);
  });
});

describe("write-time safety", () => {
  const opts = (over: Record<string, unknown> = {}) => ({
    confirm: true as const,
    findings: [finding()],
    env: { FAMILYSEARCH_ENV: "beta" } as NodeJS.ProcessEnv,
    writer: makeAdapter(),
    confirmOperation: async () => true,
    sourceDescriptionsVerified: true,
    sleep: async () => {},
    ...over,
  });

  it("posts nothing when the person became living after the plan was reviewed", async () => {
    const reviewed = buildPlan(PID, [finding()], doc());
    const living = doc();
    living.persons![0].living = true;
    mockRead(living);
    const results = await applyPlan(reviewed, opts());
    expect(results.every((r) => r.status === "already_present")).toBe(true);
  });

  it("does not execute an operation that is absent from the reviewed plan", async () => {
    const reviewed = buildPlan(PID, [finding()], doc());
    reviewed.operations = reviewed.operations.filter((o) => o.type !== "add_note");
    mockRead(personFixture);
    nock(API).post("/platform/sources/descriptions").reply(201, "", { "X-Entity-Id": "Q1" });
    nock(API).post(`/platform/tree/persons/${PID}`).reply(201);
    const results = await applyPlan(reviewed, opts());
    expect(results.map((r) => r.status)).toEqual(["posted", "posted"]);
  });

  it("records a failed confirmation callback and stops", async () => {
    const reviewed = buildPlan(PID, [finding()], doc());
    mockRead(personFixture);
    const results = await applyPlan(
      reviewed,
      opts({ confirmOperation: async () => { throw new Error("stdin closed"); } })
    );
    expect(results[0]).toMatchObject({ status: "failed" });
    expect(results.slice(1).every((r) => r.status === "not_run")).toBe(true);
  });
});

describe("redirects and merged persons", () => {
  it("throws PersonMergedError on 301 instead of following it", async () => {
    nock(API)
      .get(`/platform/tree/persons/${PID}`)
      .query(true)
      .reply(301, "", { Location: `${API}/platform/tree/persons/KWCH-999` });
    await expect(makeAdapter().readPerson(PID)).rejects.toMatchObject({
      name: "PersonMergedError",
      survivorPid: "KWCH-999",
    });
  });

  it("does not record a write as posted when a redirect is returned", async () => {
    nock(API)
      .post(`/platform/tree/persons/${PID}/notes`)
      .reply(301, "", { Location: `${API}/platform/tree/persons/KWCH-999/notes` });
    await expect(
      makeAdapter().postGedcomx(`/platform/tree/persons/${PID}/notes`, {})
    ).rejects.toMatchObject({ name: "PersonMergedError" });
  });

  it("rejects a write answered with a bare 200", async () => {
    nock(API).post("/platform/sources/descriptions").reply(200);
    await expect(
      makeAdapter().postGedcomx("/platform/sources/descriptions", {})
    ).rejects.toThrow(/HTTP 200/);
  });

  it("rejects a read whose payload lacks the requested person", async () => {
    nock(API).get(`/platform/tree/persons/OTHER-1`).query(true).reply(200, personFixture);
    await expect(makeAdapter().readPerson("OTHER-1")).rejects.toThrow(/does not contain/);
  });
});
