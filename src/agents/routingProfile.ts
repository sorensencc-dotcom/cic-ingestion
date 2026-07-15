import { getModelSpec } from "../core/modelRegistry";
import { ModelSpec } from "../core/modelSpec";
import { RoutingError } from "../core/errors";

export class AgentRoutingProfile {
  private readonly preferredModels: string[];
  private readonly fallbackModels: string[];
  readonly mode?: "local" | "hybrid" | "cloud" | undefined;

  constructor(
    preferredModels: string[],
    fallbackModels: string[] = [],
    mode?: "local" | "hybrid" | "cloud" | undefined
  ) {
    this.preferredModels = preferredModels;
    this.fallbackModels = fallbackModels;
    this.mode = mode;
    this.validateModels();
  }

  pickModel(): string {
    const candidates = [...this.preferredModels, ...this.fallbackModels]
      .map((name) => {
        let score = 0;
        try {
          const spec = getModelSpec(name);
          score = this.computeModelScore(spec, this.preferredModels.includes(name));
        } catch {
          // Model spec might be missing; score remains 0
        }
        return { name, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) {
      throw new RoutingError("No valid models configured for routing profile");
    }

    return candidates[0].name;
  }

  private computeModelScore(spec: ModelSpec, isPreferred: boolean): number {
    let score = 50; // baseline

    // Preferred models get boost
    if (isPreferred) score += 50;

    // Capability bonus
    if (spec.supports?.toolCalls) score += 20;
    if (spec.supports?.streaming) score += 10;

    // Explicit routing score if present
    if (spec.routing?.score) score = spec.routing.score;

    return Math.max(1, score); // ensure non-zero
  }

  private validateModels(): void {
    if (this.preferredModels.length === 0 && this.fallbackModels.length === 0) {
      throw new RoutingError("AgentRoutingProfile requires at least one model");
    }
  }
}
