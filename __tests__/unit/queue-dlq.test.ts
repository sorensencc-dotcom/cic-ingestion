import { DeadLetterQueue } from "../../src/queue/dlq";

test("dlq pushes job", () => {
  const d = new DeadLetterQueue();
  const out = d.push({ id: "1", type: "test", payload: {} }, new Error("x"));
  expect(out.status).toBe("stored");
});
