import { bootVM } from "../../src/sandbox/firecracker";

describe("Firecracker Boot", () => {
  test("boot time under threshold", async () => {
    const ms = await bootVM();
    expect(ms).toBeLessThan(300);
  });
});
