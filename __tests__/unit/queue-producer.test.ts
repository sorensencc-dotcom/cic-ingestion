import { Producer } from "../../src/queue/producer";

test("producer queues job", () => {
  const p = new Producer();
  const out = p.enqueue({ id: "1", type: "ingest", payload: { data: "test" } });
  expect(out.status).toBe("queued");
  expect(out.jobId).toBe("1");
});
