import { MaalOrchestratorV3 } from "../maal/core/maal-orchestrator-v3";

export class RoutingDeterminismValidator {
  private orchestrator: MaalOrchestratorV3;

  constructor() {
    this.orchestrator = new MaalOrchestratorV3(500);
  }

  async validateDeterminism(): Promise<boolean> {
    try {
      const testPayload = { model: "test-model", input: "determinism-check" };
      const seed = 42;

      // Run 1
      const result1 = await this.orchestrator.executePayload("test-model", testPayload, seed);

      // Run 2 - same seed
      const result2 = await this.orchestrator.executePayload("test-model", testPayload, seed);

      // Compare routing decisions
      return this.compareResults(result1, result2);
    } catch (e) {
      console.error(`Routing determinism validation failed: ${e}`);
      return false;
    }
  }

  private compareResults(r1: any, r2: any): boolean {
    // Check that both runs made same routing decision
    if (!r1.routingDecision || !r2.routingDecision) {
      return false;
    }

    return (
      r1.routingDecision.tier === r2.routingDecision.tier &&
      r1.routingDecision.reasons === r2.routingDecision.reasons
    );
  }
}
