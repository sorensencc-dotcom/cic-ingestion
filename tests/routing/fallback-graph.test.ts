import { validateFallbackGraph } from "../../src/routing/fallbackGraph";

describe("Fallback Graph", () => {
  test("graph is valid", () => {
    const ok = validateFallbackGraph();
    expect(ok).toBe(true);
  });
});
