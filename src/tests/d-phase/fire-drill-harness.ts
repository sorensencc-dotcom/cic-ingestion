import { ChatResult, ResponseValidator } from "../../core/modelRouter";
import { ModelSpec } from "../../core/modelSpec";
import { MockProvider } from "../mocks/mockProvider";

export interface FireDrillResult {
  name: string;
  mode: string;
  passed: boolean;
  error?: string;
  result?: ChatResult;
  fallbackUsed?: boolean;
}

const TEST_SPEC: ModelSpec = {
  name: "test-model",
  provider: "mock",
  type: "mock",
  env: "",
  apiBase: "",
  supports: {
    chat: true,
    toolCalls: true,
    vision: true,
    streaming: true,
    embeddings: true,
  },
};

export class FireDrillHarness {
  private mockProvider: MockProvider;
  private results: FireDrillResult[] = [];

  constructor(mockProvider: MockProvider) {
    this.mockProvider = mockProvider;
  }

  async runAll(): Promise<FireDrillResult[]> {
    this.results = [];
    await this.d1_internalError();
    await this.d2_timeout();
    await this.d3_malformedJson();
    await this.d4_emptyResponse();
    await this.d5_driftedResponse();
    await this.d6_capabilityMismatch();
    return this.results;
  }

  private async d1_internalError(): Promise<void> {
    const drill: FireDrillResult = { name: "D-1", mode: "500_error", passed: false };
    try {
      this.mockProvider.simulate({ type: "500" });
      await this.mockProvider.callChat(TEST_SPEC, { model: "test-model", messages: [] });
    } catch (err: any) {
      drill.error = err.message;
      drill.passed = true;
    }
    this.results.push(drill);
  }

  private async d2_timeout(): Promise<void> {
    const drill: FireDrillResult = { name: "D-2", mode: "timeout", passed: false };
    try {
      this.mockProvider.simulate({ type: "timeout", delayMs: 100 });
      await this.mockProvider.callChat(TEST_SPEC, { model: "test-model", messages: [] });
    } catch (err: any) {
      drill.error = err.message;
      drill.passed = true;
    }
    this.results.push(drill);
  }

  private async d3_malformedJson(): Promise<void> {
    const drill: FireDrillResult = { name: "D-3", mode: "malformed_json", passed: false };
    try {
      this.mockProvider.simulate({ type: "malformed" });
      await this.mockProvider.callChat(TEST_SPEC, { model: "test-model", messages: [] });
    } catch (err: any) {
      drill.error = err.message;
      drill.passed = true;
    }
    this.results.push(drill);
  }

  private async d4_emptyResponse(): Promise<void> {
    const drill: FireDrillResult = { name: "D-4", mode: "empty_response", passed: false };
    try {
      this.mockProvider.simulate({ type: "empty" });
      const result = await this.mockProvider.callChat(TEST_SPEC, {
        model: "test-model",
        messages: [],
      });
      const isValid = ResponseValidator.validateText(result.text);
      drill.passed = !isValid.valid;
    } catch (err: any) {
      drill.error = err.message;
    }
    this.results.push(drill);
  }

  private async d5_driftedResponse(): Promise<void> {
    const drill: FireDrillResult = { name: "D-5", mode: "drifted_response", passed: false };
    try {
      this.mockProvider.simulate({ type: "drift" });
      const result = await this.mockProvider.callChat(TEST_SPEC, {
        model: "test-model",
        messages: [],
      });
      drill.passed = !!result && result.text !== "OK response";
    } catch (err: any) {
      drill.error = err.message;
    }
    this.results.push(drill);
  }

  private async d6_capabilityMismatch(): Promise<void> {
    const drill: FireDrillResult = { name: "D-6", mode: "capability_mismatch", passed: false };
    try {
      this.mockProvider.simulate({ type: "capability_mismatch" });
      const payload = {
        model: "test-model",
        messages: [],
        requires: { vision: true },
      };
      const spec = { ...TEST_SPEC, supports: { ...TEST_SPEC.supports, vision: false } };
      const result = await this.mockProvider.callChat(spec, payload);
      const isValid = ResponseValidator.validateCapability(result.raw, payload.requires, spec);
      drill.passed = !isValid.valid;
    } catch (err: any) {
      drill.error = err.message;
    }
    this.results.push(drill);
  }

  getResults(): FireDrillResult[] {
    return this.results;
  }

  getSummary(): { total: number; passed: number; failed: number; passRate: string } {
    const passed = this.results.filter((r) => r.passed).length;
    return {
      total: this.results.length,
      passed,
      failed: this.results.length - passed,
      passRate: ((passed / this.results.length) * 100).toFixed(1) + "%",
    };
  }
}
