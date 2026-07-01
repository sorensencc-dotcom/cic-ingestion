import { evaluateConstraints } from "../../src/maal/constraintEngine";

describe("Constraint Engine", () => {
  test("constraints produce deterministic results", () => {
    const result1 = evaluateConstraints({ latency: 20, cost: 1 });
    const result2 = evaluateConstraints({ latency: 20, cost: 1 });
    expect(result1).toEqual(result2);
  });
});
