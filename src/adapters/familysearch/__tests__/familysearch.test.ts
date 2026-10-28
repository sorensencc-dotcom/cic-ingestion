import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import nock from "nock";
import { FamilySearchAdapter } from "../FamilySearchAdapter";
import { parseFamilySearchEnv } from "../environments";
import { mapDocument } from "../mapper";
import {
  FamilySearchAuthError,
  RefreshTokenProvider,
  StaticTokenProvider,
  buildAuthorizationUrl,
  createTokenProviderFromEnv,
  exchangeAuthorizationCode,
} from "../tokenProvider";
import personFixture from "./fixtures/person.json";
import searchFixture from "./fixtures/search.json";

const API = "https://apibeta.familysearch.org";
const IDENT = "https://identbeta.familysearch.org";
const TOKEN_PATH = "/cis-web/oauth2/v3/token";

function adapterWith(tokenProvider: StaticTokenProvider | RefreshTokenProvider, sleep = jest.fn(async () => {})) {
  const adapter = new FamilySearchAdapter({
    name: "familysearch",
    version: "test",
    timeout: 2000,
    retries: 3,
    tokenProvider,
    sleep,
  });
  return { adapter, sleep };
}

beforeEach(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  expect(nock.pendingMocks()).toEqual([]);
  nock.cleanAll();
  nock.enableNetConnect();
});

describe("environment", () => {
  it("defaults to beta and rejects unknown values", () => {
    expect(parseFamilySearchEnv(undefined)).toBe("beta");
    expect(parseFamilySearchEnv("Production")).toBe("production");
    expect(() => parseFamilySearchEnv("staging")).toThrow(/FAMILYSEARCH_ENV/);
  });

  it("routes production traffic to api.familysearch.org", async () => {
    nock("https://api.familysearch.org").get("/platform/tree/persons/KWCH-1AB").query(true).reply(200, personFixture);
    const adapter = new FamilySearchAdapter({
      name: "familysearch", version: "t", timeout: 1000, retries: 1,
      env: "production", tokenProvider: new StaticTokenProvider("tok"),
    });
    expect((await adapter.run({ key: "KWCH-1AB", payload: {} })).success).toBe(true);
  });
});

describe("token provider", () => {
  const tokenReply = (access: string, extra: object = {}) => ({ access_token: access, token_type: "Bearer", ...extra });

  it("refreshes once, caches, and refreshes again after expiry", async () => {
    let now = 1_000_000;
    nock(IDENT).post(TOKEN_PATH, (b) => b.grant_type === "refresh_token" && b.client_id === "app-key" && b.refresh_token === "r1")
      .reply(200, tokenReply("a1", { expires_in: 3600, refresh_token: "r2" }));
    const provider = new RefreshTokenProvider({ env: "beta", clientId: "app-key", refreshToken: "r1", now: () => now });

    expect(await provider.getToken()).toBe("a1");
    expect(await provider.getToken()).toBe("a1");

    now += 3600 * 1000;
    nock(IDENT).post(TOKEN_PATH, (b) => b.refresh_token === "r2").reply(200, tokenReply("a2", { expires_in: 3600 }));
    expect(await provider.getToken()).toBe("a2");
  });

  it("shares one in-flight refresh across concurrent callers", async () => {
    nock(IDENT).post(TOKEN_PATH).once().reply(200, tokenReply("a1"));
    const provider = new RefreshTokenProvider({ env: "beta", clientId: "k", refreshToken: "r" });
    const tokens = await Promise.all([provider.getToken(), provider.getToken(), provider.getToken()]);
    expect(tokens).toEqual(["a1", "a1", "a1"]);
  });

  it("surfaces a token failure without leaking credentials", async () => {
    nock(IDENT).post(TOKEN_PATH).reply(400, { error: "invalid_grant" });
    const provider = new RefreshTokenProvider({ env: "beta", clientId: "k", refreshToken: "super-secret-refresh", clientSecret: "super-secret-client" });
    const error = await provider.getToken().catch((e: Error) => e);
    expect(error).toBeInstanceOf(FamilySearchAuthError);
    expect((error as Error).message).toBe("FamilySearch token request failed (HTTP 400): invalid_grant");
  });

  it("builds the authorization URL and exchanges a code", async () => {
    const url = new URL(buildAuthorizationUrl({ env: "production", clientId: "k", redirectUri: "https://x.test/cb", state: "s1" }));
    expect(url.origin + url.pathname).toBe("https://ident.familysearch.org/cis-web/oauth2/v3/authorization");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("k");

    nock(IDENT).post(TOKEN_PATH, (b) => b.grant_type === "authorization_code" && b.code === "c1" && b.redirect_uri === "https://x.test/cb")
      .reply(200, tokenReply("a1", { refresh_token: "r1" }));
    const tokens = await exchangeAuthorizationCode({ env: "beta", clientId: "k", redirectUri: "https://x.test/cb", code: "c1" });
    expect(tokens.accessToken).toBe("a1");
    expect(tokens.refreshToken).toBe("r1");
  });

  it("prefers a refresh flow over a bare token and requires an app key for it", () => {
    expect(createTokenProviderFromEnv("beta", { FAMILYSEARCH_ACCESS_TOKEN: "t" })).toBeInstanceOf(StaticTokenProvider);
    expect(createTokenProviderFromEnv("beta", { FAMILYSEARCH_REFRESH_TOKEN: "r", FAMILYSEARCH_APP_KEY: "k" })).toBeInstanceOf(RefreshTokenProvider);
    expect(() => createTokenProviderFromEnv("beta", { FAMILYSEARCH_REFRESH_TOKEN: "r" })).toThrow(/APP_KEY/);
    expect(() => createTokenProviderFromEnv("beta", {})).toThrow(FamilySearchAuthError);
  });
});

describe("person read", () => {
  it("sends bearer token and GEDCOM X accept header, maps the payload", async () => {
    nock(API, { reqheaders: { authorization: "Bearer tok", accept: "application/x-gedcomx-v1+json" } })
      .get("/platform/tree/persons/KWCH-1AB").query({ relatives: "true", sourceDescriptions: "true" })
      .reply(200, personFixture);
    const { adapter } = adapterWith(new StaticTokenProvider("tok"));
    const out = adapter.validate(await adapter.run(adapter.normalize("KWCH-1AB")));

    expect(out.success).toBe(true);
    expect(out.data.persons.map((p: any) => p.pid)).toEqual(["KWCH-1AB", "KWCH-2CD", "KWCH-3EF"]);
    expect(out.data.raw).toEqual(personFixture);
    expect(out.score).toBeGreaterThanOrEqual(0.8);
  });

  it("retries after a 401 with a refreshed token", async () => {
    nock(IDENT).post(TOKEN_PATH).reply(200, { access_token: "fresh" });
    nock(API, { reqheaders: { authorization: "Bearer stale" } }).get("/platform/tree/persons/KWCH-1AB").query(true).reply(401);
    nock(API, { reqheaders: { authorization: "Bearer fresh" } }).get("/platform/tree/persons/KWCH-1AB").query(true).reply(200, personFixture);
    const provider = new RefreshTokenProvider({ env: "beta", clientId: "k", refreshToken: "r", accessToken: "stale" });
    const { adapter } = adapterWith(provider);
    expect((await adapter.run({ key: "KWCH-1AB", payload: {} })).success).toBe(true);
  });

  it("fails clearly when a static token is rejected", async () => {
    nock(API).get("/platform/tree/persons/X").query(true).reply(401);
    const { adapter } = adapterWith(new StaticTokenProvider("tok"));
    const out = await adapter.run({ key: "X", payload: {} });
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/expired or was rejected/);
  });

  it("honors Retry-After on 429 and then succeeds", async () => {
    nock(API).get("/platform/tree/persons/KWCH-1AB").query(true).reply(429, "", { "Retry-After": "2" });
    nock(API).get("/platform/tree/persons/KWCH-1AB").query(true).reply(200, personFixture);
    const { adapter, sleep } = adapterWith(new StaticTokenProvider("tok"));
    expect((await adapter.run({ key: "KWCH-1AB", payload: {} })).success).toBe(true);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("gives up after the 429 retry budget", async () => {
    nock(API).get("/platform/tree/persons/KWCH-1AB").query(true).times(4).reply(429, "", { "Retry-After": "1" });
    const { adapter, sleep } = adapterWith(new StaticTokenProvider("tok"));
    const out = await adapter.run({ key: "KWCH-1AB", payload: {} });
    expect(out).toMatchObject({ success: false, error: "FamilySearch API error: HTTP 429" });
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it("rejects a payload that is not a GEDCOM X person document", async () => {
    nock(API).get("/platform/tree/persons/X").query(true).reply(200, { persons: [] });
    const { adapter } = adapterWith(new StaticTokenProvider("tok"));
    const out = await adapter.run({ key: "X", payload: {} });
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/persons/);
  });

  it("validate() rejects output whose raw payload is not GEDCOM X", () => {
    const { adapter } = adapterWith(new StaticTokenProvider("tok"));
    const bad = { success: true, timestamp: 1, data: { persons: [{ pid: "A", name: "A" }], relationships: [], sources: [], raw: {} } };
    expect(adapter.validate(bad).success).toBe(false);
  });
});

describe("mapper", () => {
  const mapped = mapDocument(personFixture as any);

  it("maps names, birth and death from facts, falling back to display", () => {
    expect(mapped.persons[0]).toEqual({
      pid: "KWCH-1AB",
      name: "John Smith",
      lifespan: {
        birth: { date: "3 May 1850", place: "Leeds, Yorkshire, England" },
        death: { date: "1 Jan 1920", place: "Provo, Utah, United States" },
      },
    });
    expect(mapped.persons[1].lifespan).toEqual({ birth: { date: "1855", place: "Bath, Somerset, England" } });
    expect(mapped.persons[2].name).toBe("William Smith");
  });

  it("builds couples by gender regardless of person1/person2 order, with children and marriage", () => {
    expect(mapped.relationships).toHaveLength(1);
    const couple = mapped.relationships[0];
    expect(couple.relationshipId).toBe("R-COUPLE");
    expect(couple.husband?.pid).toBe("KWCH-1AB");
    expect(couple.wife?.pid).toBe("KWCH-2CD");
    expect(couple.children.map((c) => c.pid)).toEqual(["KWCH-3EF"]);
    expect(couple.married).toEqual({ date: "1875", place: "Leeds" });
  });

  it("maps source descriptions and keeps the raw payload", () => {
    expect(mapped.sources).toEqual([{ id: "SD-1", title: "England Census, 1851", url: "https://www.familysearch.org/ark:/61903/1:1:XXXX" }]);
    expect(mapped.raw).toBe(personFixture);
  });
});

describe("search", () => {
  it("queries /platform/tree/search with q. terms and returns scored, paged hits", async () => {
    nock(API, { reqheaders: { accept: "application/x-gedcomx-atom+json", authorization: "Bearer tok" } })
      .get("/platform/tree/search")
      .query({ "q.givenName": "John", "q.surname": "Smith", "q.birthLikeDate": "+1850", "q.birthLikePlace": "Leeds", "q.deathLikeDate": "+1920", offset: "0", count: "2" })
      .reply(200, searchFixture);
    const { adapter } = adapterWith(new StaticTokenProvider("tok"));
    const result = await adapter.search({ givenName: "John", surname: "Smith", birthLikeDate: "+1850", birthLikePlace: "Leeds", deathLikeDate: "+1920", count: 2 });

    expect(result.total).toBe(3);
    expect(result.hits.map((h) => [h.pid, h.score])).toEqual([["BBBB-222", 0.95], ["AAAA-111", 0.42]]);
    expect(result.hits[0].person).toEqual({ pid: "BBBB-222", name: "John Smith", lifespan: { birth: { date: "3 May 1850", place: "Leeds" } } });
    expect(result.nextOffset).toBe(2);
  });

  it("pages with offset and reports no next page at the end", async () => {
    nock(API).get("/platform/tree/search").query({ "q.surname": "Smith", offset: "2", count: "2" })
      .reply(200, { ...searchFixture, entries: [searchFixture.entries[0]] });
    const { adapter } = adapterWith(new StaticTokenProvider("tok"));
    const result = await adapter.search({ surname: "Smith", offset: 2, count: 2 });
    expect(result.offset).toBe(2);
    expect(result.nextOffset).toBeUndefined();
  });

  it("treats 204 as an empty result and requires a query term", async () => {
    nock(API).get("/platform/tree/search").query(true).reply(204);
    const { adapter } = adapterWith(new StaticTokenProvider("tok"));
    expect(await adapter.search({ surname: "Nobody" })).toMatchObject({ total: 0, hits: [] });
    await expect(adapter.search({})).rejects.toThrow(/at least one query term/);
  });

  it("retries search on 429", async () => {
    nock(API).get("/platform/tree/search").query(true).reply(429, "", { "Retry-After": "1" });
    nock(API).get("/platform/tree/search").query(true).reply(200, searchFixture);
    const { adapter, sleep } = adapterWith(new StaticTokenProvider("tok"));
    expect((await adapter.search({ surname: "Smith" })).hits).toHaveLength(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  });
});
