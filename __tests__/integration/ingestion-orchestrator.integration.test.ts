import { IngestionOrchestrator } from "../../src/orchestrator/IngestionOrchestrator";
import { Producer } from "../../src/queue/producer";
import { DeadLetterQueue } from "../../src/queue/dlq";
import { IExtractor } from "../../src/extractors/IExtractor";

class TestExtractor extends IExtractor {
  async extract(input: any) {
    return { ...input, extracted: true };
  }
}

test("integration: orchestrator handles record", async () => {
  const producer = new Producer();
  const dlq = new DeadLetterQueue();
  const extractor = new TestExtractor();
  const orchestrator = new IngestionOrchestrator(producer, dlq, extractor);

  const result = await orchestrator.run({ id: "abc" });

  expect(result.recordId).toBe("abc");
  expect(result.status).toBe("success");
});
