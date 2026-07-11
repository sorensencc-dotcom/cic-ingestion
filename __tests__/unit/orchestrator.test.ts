import { IngestionOrchestrator } from "../../src/orchestrator/IngestionOrchestrator";
import { Producer } from "../../src/queue/producer";
import { DeadLetterQueue } from "../../src/queue/dlq";
import { IExtractor } from "../../src/extractors/IExtractor";

test("runs orchestrator with full pipeline", async () => {
  const producer = new Producer();
  const dlq = new DeadLetterQueue();
  const extractor = new (class extends IExtractor {
    async extract(input: any) {
      return { extracted: true, data: input };
    }
  })();

  const o = new IngestionOrchestrator(producer, dlq, extractor);
  const out = await o.run({ id: "1" });

  expect(out.status).toBe("success");
  expect(out.recordId).toBe("1");
  await o.waitForCompletion(5000);
});
