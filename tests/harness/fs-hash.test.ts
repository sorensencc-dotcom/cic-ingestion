import { computeFsHash } from "../../src/harness/fsHash";

describe("Filesystem Hash", () => {
  test("fsHash deterministic", async () => {
    const h1 = await computeFsHash();
    const h2 = await computeFsHash();
    expect(h1).toBe(h2);
  });
});
