import { selectRegime } from "../../src/maal/regimeSelector";

describe("MAAL Routing Regimes", () => {
  test("deterministic regime selection", () => {
    const fp = { task: "summarize", size: 128 };
    const regime1 = selectRegime(fp);
    const regime2 = selectRegime(fp);
    expect(regime1).toBe(regime2);
  });
});
