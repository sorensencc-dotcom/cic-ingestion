import { runInference } from "../../src/sandbox/onnx";

describe("ONNX Inference", () => {
  test("deterministic inference", async () => {
    const out1 = await runInference([1, 2, 3]);
    const out2 = await runInference([1, 2, 3]);
    expect(out1).toEqual(out2);
  });
});
