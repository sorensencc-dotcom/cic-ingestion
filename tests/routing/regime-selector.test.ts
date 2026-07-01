import { selectRegime } from "../../src/routing/regimeSelector";

describe("Regime Selector", () => {
  test("same input → same regime", () => {
    const fp = { task: "translate", size: 64 };
    expect(selectRegime(fp)).toBe(selectRegime(fp));
  });
});
