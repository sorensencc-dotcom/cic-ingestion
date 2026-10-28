import { describe, expect, it } from "@jest/globals";
import { buildAuthorizationUrl } from "../tokenProvider";
import { extractEnvFileArg, parseEnvText } from "../cli/envFile";
import {
  DEFAULT_REDIRECT_URI,
  evaluateCallback,
  generateState,
  powershellTokenLine,
  resolveLoginConfig,
  statesMatch,
} from "../cli/login";
import { formatPersonSummary, redactSecrets } from "../cli/personSummary";
import { GedcomxDocument } from "../schema";

describe("login state and callback", () => {
  it("generates unique url-safe states", () => {
    const a = generateState();
    expect(a).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(generateState()).not.toBe(a);
  });

  it("matches only identical state", () => {
    expect(statesMatch("abc", "abc")).toBe(true);
    expect(statesMatch("abc", "abd")).toBe(false);
    expect(statesMatch("abc", "abcd")).toBe(false);
    expect(statesMatch("abc", null)).toBe(false);
  });

  it("accepts code with matching state", () => {
    expect(evaluateCallback("/callback?code=XYZ&state=s1", "/callback", "s1")).toEqual({
      kind: "code",
      code: "XYZ",
    });
  });

  it("rejects state mismatch even when code present", () => {
    expect(evaluateCallback("/callback?code=XYZ&state=evil", "/callback", "s1").kind).toBe("error");
  });

  it("reports provider error and missing code", () => {
    expect(evaluateCallback("/callback?error=access_denied&state=s1", "/callback", "s1")).toEqual({
      kind: "error",
      message: "Authorization denied: access_denied",
    });
    expect(evaluateCallback("/callback?state=s1", "/callback", "s1").kind).toBe("error");
  });

  it("ignores other paths", () => {
    expect(evaluateCallback("/favicon.ico", "/callback", "s1").kind).toBe("ignore");
  });
});

describe("login config", () => {
  const base = { FAMILYSEARCH_APP_KEY: "key" } as NodeJS.ProcessEnv;

  it("defaults to beta and default redirect", () => {
    const cfg = resolveLoginConfig(base, false);
    expect(cfg).toMatchObject({ env: "beta", redirectUri: DEFAULT_REDIRECT_URI, port: 3000, callbackPath: "/callback" });
  });

  it("refuses production without flag", () => {
    const vars = { ...base, FAMILYSEARCH_ENV: "production" };
    expect(() => resolveLoginConfig(vars, false)).toThrow(/production/);
    expect(resolveLoginConfig(vars, true).env).toBe("production");
  });

  it("requires app key and local redirect", () => {
    expect(() => resolveLoginConfig({}, false)).toThrow(/APP_KEY/);
    expect(() =>
      resolveLoginConfig({ ...base, FAMILYSEARCH_REDIRECT_URI: "http://evil.example/cb" }, false)
    ).toThrow(/localhost/);
  });

  it("builds the authorization url with state and redirect", () => {
    const url = new URL(
      buildAuthorizationUrl({ env: "beta", clientId: "key", redirectUri: DEFAULT_REDIRECT_URI, state: "s1" })
    );
    expect(url.origin).toBe("https://identbeta.familysearch.org");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("redirect_uri")).toBe(DEFAULT_REDIRECT_URI);
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("escapes single quotes in the PowerShell line", () => {
    expect(powershellTokenLine("a'b")).toBe("$env:FAMILYSEARCH_ACCESS_TOKEN = 'a''b'");
  });
});

describe("env file", () => {
  it("parses assignments, quotes, comments", () => {
    expect(
      parseEnvText("# c\nA=1\nexport B=\"two words\"\nC='x' \nD=val # trailing\n\nbad line")
    ).toEqual({ A: "1", B: "two words", C: "x", D: "val" });
  });

  it("extracts --env-file in both forms", () => {
    expect(extractEnvFileArg(["P1", "--env-file", "x.env"])).toEqual({ envFile: "x.env", rest: ["P1"] });
    expect(extractEnvFileArg(["--env-file=y.env", "P1"])).toEqual({ envFile: "y.env", rest: ["P1"] });
    expect(() => extractEnvFileArg(["--env-file"])).toThrow();
  });
});

describe("person summary", () => {
  const doc: GedcomxDocument = {
    persons: [
      {
        id: "LV7Q-DGW",
        names: [{ nameForms: [{ fullText: "Jane Doe" }] }],
        facts: [
          { type: "http://gedcomx.org/Birth", date: { original: "1 Jan 1900" }, place: { original: "Ohio" } },
        ],
        notes: [{ subject: "Bio", text: "Line one\n  line two" }],
      },
    ],
    relationships: [
      { person1: { resourceId: "LV7Q-DGW" }, person2: { resourceId: "AAAA-111" } },
      { person1: { resourceId: "LV7Q-DGW" }, person2: { resourceId: "BBBB-222" } },
      { person1: { resourceId: "AAAA-111" }, person2: { resourceId: "LV7Q-DGW" } },
    ],
    sourceDescriptions: [{ titles: [{ value: "1900 Census" }], about: "https://x.example/1" }],
  };

  it("summarizes names, facts, sources, notes, relatives", () => {
    const text = formatPersonSummary(doc, "LV7Q-DGW");
    expect(text).toContain("Names: Jane Doe");
    expect(text).toContain("Birth | 1 Jan 1900 | Ohio");
    expect(text).toContain("1900 Census <https://x.example/1>");
    expect(text).toContain("Bio: Line one line two");
    expect(text).toContain("Relatives: 2");
  });

  it("redacts secret-like keys recursively", () => {
    expect(
      redactSecrets({ a: { access_token: "t", email: "e", keep: 1 }, b: [{ Authorization: "x" }] })
    ).toEqual({ a: { access_token: "[REDACTED]", email: "[REDACTED]", keep: 1 }, b: [{ Authorization: "[REDACTED]" }] });
  });
});
