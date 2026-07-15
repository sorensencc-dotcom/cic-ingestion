import { ModelSpec } from "../../core/modelSpec";
import { ChatPayload, ChatResult, Provider } from "../../core/modelRouter";

export type MockFailureMode =
  | "500"
  | "timeout"
  | "malformed"
  | "empty"
  | "drift"
  | "capability_mismatch"
  | "ok";

export class MockProvider implements Provider {
  private mode: MockFailureMode = "ok";
  private delayMs = 0;

  simulate(config: { type: MockFailureMode; delayMs?: number }): void {
    this.mode = config.type;
    this.delayMs = config.delayMs ?? 0;
  }

  async callChat(spec: ModelSpec, payload: ChatPayload): Promise<ChatResult> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }

    switch (this.mode) {
      case "500":
        throw new Error("500: internal server error");
      case "timeout":
        return new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Simulated timeout")), 25000)
        );
      case "malformed":
        throw new SyntaxError("Unexpected token");
      case "empty":
        return {
          raw: { content: [{ type: "text", text: "" }] },
          text: "",
          model: spec.name,
        };
      case "drift":
        return {
          raw: {
            content: [{ type: "text", text: "slightly different wording than expected" }],
            model: spec.name,
          },
          text: "slightly different wording than expected",
          model: spec.name,
        };
      case "capability_mismatch":
        return {
          raw: {
            content: [{ type: "text", text: "no vision" }],
            model: "text-only-model",
          },
          text: "no vision",
          model: "text-only-model",
        };
      default:
        return {
          raw: {
            content: [{ type: "text", text: "OK response" }],
            model: spec.name,
            usage: { input_tokens: 10, output_tokens: 20 },
          },
          text: "OK response",
          tokensUsed: { input: 10, output: 20 },
          model: spec.name,
        };
    }
  }

  reset(): void {
    this.mode = "ok";
    this.delayMs = 0;
  }
}
