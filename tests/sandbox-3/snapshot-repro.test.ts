import { verifySnapshot } from "../../src/harness/snapshot";

describe("Snapshot Reproducibility", () => {
  test("snapshotHash matches", async () => {
    const ok = await verifySnapshot();
    expect(ok).toBe(true);
  });
});
