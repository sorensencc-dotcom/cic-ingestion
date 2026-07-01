import { restoreSnapshot } from "../../src/harness/snapshot";

describe("Snapshot Restore", () => {
  test("restore succeeds", async () => {
    const ok = await restoreSnapshot();
    expect(ok).toBe(true);
  });
});
