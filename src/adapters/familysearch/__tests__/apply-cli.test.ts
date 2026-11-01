import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import nock from "nock";
import { ApplyCliDeps, PlanFile, main } from "../cli/apply";
import { FamilySearchAdapter } from "../FamilySearchAdapter";
import { StaticTokenProvider } from "../tokenProvider";
import { GedcomxDocument } from "../schema";
import { ProposedFinding } from "../writePlan";
import personFixture from "./fixtures/person.json";

const API = "https://apibeta.familysearch.org";
const PID = "KWCH-1AB";
const SOURCE_URL = "https://trm.example/records/42";
const NOTE_FP = "add_note|S-42/F-1";
const ATTACH_FP = "attach_source|S-42/F-1";

const finding = (over: Partial<ProposedFinding> = {}): ProposedFinding => ({
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
});

const extractOf = (...facts: Array<[string, string]>) => ({
  facts: facts.map(([id, source_id]) => ({
    id,
    text: "free text",
    source_id,
    confidence: 0.9,
    categories: ["genealogy"],
  })),
});

function mockRead() {
  nock(API).get(`/platform/tree/persons/${PID}`).query(true).reply(200, personFixture);
  nock(API).get(`/platform/tree/persons/${PID}/notes`).reply(200, { persons: [{ id: PID, notes: [] }] });
}

const adapter = () =>
  new FamilySearchAdapter({
    name: "familysearch",
    version: "test",
    timeout: 2000,
    retries: 1,
    tokenProvider: new StaticTokenProvider("tok"),
    sleep: async () => {},
  });

let dir: string;
let log: string[];
let prompts: string[];
const path = (name: string) => join(dir, name);
const json = (name: string, value: unknown) => writeFileSync(path(name), JSON.stringify(value));

function deps(over: Partial<ApplyCliDeps> = {}, answer = "yes"): ApplyCliDeps {
  return {
    writer: adapter(),
    prompt: async (q) => {
      prompts.push(q);
      return answer;
    },
    log: (l) => log.push(l),
    vars: { FAMILYSEARCH_ENV: "beta" },
    ledgerPath: path("ledger.jsonl"),
    minIntervalMs: 0,
    sleep: async () => {},
    ...over,
  };
}

const out = () => log.join("\n");

/** Runs `plan` against a mocked read and returns the plan file and its hash. */
async function makePlan(extra: string[] = [], findings = [finding()], extract = extractOf(["F-1", "S-42"])) {
  json("findings.json", findings);
  json("extract.json", extract);
  mockRead();
  const code = await main(
    ["plan", "--pid", PID, "--findings", path("findings.json"), "--extract", path("extract.json"), "--out", path("plan.json"), ...extra],
    deps()
  );
  expect(code).toBe(0);
  const file = JSON.parse(readFileSync(path("plan.json"), "utf8")) as PlanFile;
  return { file, hash: file.hash };
}

beforeEach(() => {
  nock.disableNetConnect();
  dir = mkdtempSync(join(tmpdir(), "fs-apply-"));
  log = [];
  prompts = [];
});
afterEach(() => {
  expect(nock.pendingMocks()).toEqual([]);
  nock.cleanAll();
  nock.enableNetConnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("fs:apply plan", () => {
  it("writes the plan with a hash and posts nothing", async () => {
    const { file, hash } = await makePlan();
    expect(file.plan.operations.map((o) => o.id)).toEqual([
      "create_source_description|S-42/F-1",
      ATTACH_FP,
      NOTE_FP,
    ]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(out()).toContain(`Hash: ${hash}`);
  });

  it("refuses a finding whose fact id is missing from the extract", async () => {
    json("findings.json", [finding({ trmFactId: "F-9" })]);
    json("extract.json", extractOf(["F-1", "S-42"]));
    const code = await main(
      ["plan", "--pid", PID, "--findings", path("findings.json"), "--extract", path("extract.json"), "--out", path("plan.json")],
      deps()
    );
    expect(code).toBe(1);
    expect(out()).toContain("S-42/F-9: fact id is not in the extract");
  });

  it("refuses a finding whose source differs from the extract's source_id", async () => {
    json("findings.json", [finding()]);
    json("extract.json", extractOf(["F-1", "S-77"]));
    const code = await main(
      ["plan", "--pid", PID, "--findings", path("findings.json"), "--extract", path("extract.json"), "--out", path("plan.json")],
      deps()
    );
    expect(code).toBe(1);
    expect(out()).toContain("extract says source S-77, finding says S-42");
  });
});

describe("fs:apply apply", () => {
  it("refuses a plan hash mismatch before reading or posting", async () => {
    await makePlan();
    const code = await main(["apply", "--plan", path("plan.json"), "--hash", "0".repeat(64)], deps());
    expect(code).toBe(1);
    expect(out()).toContain("plan hash mismatch");
    expect(prompts).toEqual([]);
  });

  it("refuses a plan file whose findings were edited after review", async () => {
    const { file, hash } = await makePlan();
    file.findings[0].value = "Lived somewhere else";
    json("plan.json", file);
    const code = await main(["apply", "--plan", path("plan.json"), "--hash", hash], deps());
    expect(code).toBe(1);
    expect(out()).toContain("plan hash mismatch");
  });

  it("refuses creating a source description without --source-absent-verified", async () => {
    const { hash } = await makePlan();
    const code = await main(["apply", "--plan", path("plan.json"), "--hash", hash], deps());
    expect(code).toBe(1);
    expect(out()).toContain("source description and its absence is unverified");
    expect(prompts).toEqual([]);
  });

  it("--only posts just the named operation; a quoted fingerprint with | works", async () => {
    const { hash } = await makePlan();
    mockRead();
    let noteBody: any;
    nock(API)
      .post(`/platform/tree/persons/${PID}/notes`, (b) => ((noteBody = b), true))
      .reply(201, "", { "X-Entity-Id": "7" });
    const code = await main(["apply", "--plan", path("plan.json"), "--hash", hash, "--only", NOTE_FP], deps());
    expect(code).toBe(0);
    expect(noteBody.persons[0].notes[0].text).toContain("[TRM:S-42/F-1]");
    expect(prompts).toHaveLength(1);
    expect(out()).toContain(`POST ${API}/platform/tree/persons/${PID}/notes`);
    expect(out()).toContain("Environment: beta");
    const entries = readFileSync(path("ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(entries.map((e) => e.phase)).toEqual(["intent", "done"]);
  });

  it("--only with an unknown fingerprint is refused", async () => {
    const { hash } = await makePlan();
    const code = await main(["apply", "--plan", path("plan.json"), "--hash", hash, "--only", "add_note|S-42/F-9"], deps());
    expect(code).toBe(1);
    expect(out()).toContain("matches no operation");
  });

  it("shows @op refs as a placeholder, then posts the resolved URL", async () => {
    const { hash } = await makePlan();
    mockRead();
    nock(API)
      .post("/platform/sources/descriptions")
      .reply(201, "", { "X-Entity-Id": "QDS-NEW", Location: `${API}/platform/sources/descriptions/QDS-NEW` });
    let attachBody: any;
    nock(API)
      .post(`/platform/tree/persons/${PID}`, (b) => ((attachBody = b), true))
      .reply(201, "", { "X-Entity-Id": "SRSR-1" });
    nock(API).post(`/platform/tree/persons/${PID}/notes`).reply(201, "", { "X-Entity-Id": "7" });
    const code = await main(
      ["apply", "--plan", path("plan.json"), "--hash", hash, "--source-absent-verified"],
      deps()
    );
    expect(code).toBe(0);
    expect(out()).toContain("<URL of the description op create_source_description|S-42/F-1 will create>");
    expect(attachBody.persons[0].sources[0].description).toBe(`${API}/platform/sources/descriptions/QDS-NEW`);
    expect(prompts).toHaveLength(3);
  });

  it("refuses a target already in the ledger even after the fact id renumbers", async () => {
    const existing = ["--existing-source", "S-42=SD-NEW"];
    const first = await makePlan(existing);
    mockRead();
    nock(API).post(`/platform/tree/persons/${PID}`).reply(201, "", { "X-Entity-Id": "SRSR-1" });
    expect(await main(["apply", "--plan", path("plan.json"), "--hash", first.hash, "--only", ATTACH_FP], deps())).toBe(0);
    expect(out()).toContain(`${API}/platform/sources/descriptions/SD-NEW`);

    // Same source description, fact now numbered F-2 after a regenerate: no new POST.
    log = [];
    const second = await makePlan(
      existing,
      [finding({ trmFactId: "F-2" })],
      extractOf(["F-2", "S-42"])
    );
    mockRead();
    const code = await main(
      ["apply", "--plan", path("plan.json"), "--hash", second.hash, "--only", "attach_source|S-42/F-2"],
      deps()
    );
    expect(code).toBe(0);
    expect(out()).toContain("ledger: already posted");
    expect(prompts).toHaveLength(1);
  });

  it("an intent without completion blocks a re-post and is never retried", async () => {
    const { hash } = await makePlan();
    mockRead();
    nock(API).post(`/platform/tree/persons/${PID}/notes`).reply(400, "bad");
    const first = await main(["apply", "--plan", path("plan.json"), "--hash", hash, "--only", NOTE_FP], deps());
    expect(first).toBe(1);
    const entries = readFileSync(path("ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(entries.map((e) => e.phase)).toEqual(["intent"]);

    log = [];
    prompts = [];
    mockRead();
    const second = await main(["apply", "--plan", path("plan.json"), "--hash", hash, "--only", NOTE_FP], deps());
    expect(second).toBe(0);
    expect(out()).toContain("never completed");
    expect(prompts).toEqual([]);
  });

  it("hard-refuses a non-beta writer even when the production env guard is open", async () => {
    const { hash } = await makePlan();
    const prod = Object.assign(Object.create(adapter()), { env: "production" });
    const code = await main(
      ["apply", "--plan", path("plan.json"), "--hash", hash],
      deps({ writer: prod, vars: { FAMILYSEARCH_ENV: "production", FAMILYSEARCH_ALLOW_PRODUCTION_WRITES: "1" } })
    );
    expect(code).toBe(1);
    expect(out()).toContain("beta-only");
    expect(prompts).toEqual([]);
  });
});
