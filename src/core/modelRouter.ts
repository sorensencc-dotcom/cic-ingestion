import { ModelSpec } from "./modelSpec";
import { AgentRoutingProfile } from "../agents/routingProfile";
import { getModelSpec } from "./modelRegistry";
import { openaiCompatibleProvider } from "../providers/openaiCompatible";
import { anthropicProvider } from "../providers/anthropic";
import { googleProvider } from "../providers/google";
import { ollamaProvider } from "../providers/ollama";
import { localProvider } from "../providers/local";
import { azureOpenAIProvider } from "../providers/azureOpenAI";
import { mockProvider } from "../providers/mock";
import { ProviderError, RoutingError } from "./errors";
import { logEvent } from "../observability/events";

export interface ChatPayload {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  tools?: any[];
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  requires?: {
    toolCalls?: boolean;
    vision?: boolean;
    streaming?: boolean;
    embeddings?: boolean;
  };
}

export interface ChatResult {
  raw: any;
  text: string;
  tokensUsed?: {
    input: number;
    output: number;
  };
  model: string;
  fallbackUsed?: boolean;
}

export interface Provider {
  callChat(spec: ModelSpec, payload: ChatPayload): Promise<ChatResult>;
}

export interface RouterConfig {
  providerTimeoutMs?: number;
  driftThresholdPct?: number;
}

export class ResponseValidator {
  static validateStructure(raw: any): { valid: boolean; reason?: string } {
    if (!raw || typeof raw !== "object") return { valid: false, reason: "Not an object" };
    if (!("content" in raw) && !("choices" in raw))
      return { valid: false, reason: "Missing content/choices" };
    return { valid: true };
  }

  static validateText(text: string): { valid: boolean; reason?: string } {
    if (!text || text.trim().length === 0) return { valid: false, reason: "Empty response" };
    return { valid: true };
  }

  static validateCapability(
    raw: any,
    requires?: ChatPayload["requires"],
    spec?: ModelSpec
  ): { valid: boolean; reason?: string } {
    if (!requires) return { valid: true };
    if (requires.vision && spec?.supports?.vision === false)
      return { valid: false, reason: "No vision capability" };
    if (requires.toolCalls && !raw.tool_calls && !raw.choices?.[0]?.tool_calls)
      return { valid: false, reason: "No tool calls" };
    return { valid: true };
  }
}

export class ModelRouter {
  private registry: Map<string, ModelSpec>;

  constructor(registry: Map<string, ModelSpec>) {
    this.registry = registry;
  }

  selectModel(profile: AgentRoutingProfile, payload: ChatPayload): ModelSpec {
    const mode = (profile as any).mode ?? process.env.MAAL_MODE ?? "hybrid";
    const candidates = [
      ...((profile as any)["preferredModels"] || []),
      ...((profile as any)["fallbackModels"] || []),
    ]
      .map((name: string) => this.registry.get(name))
      .filter((m: ModelSpec | undefined): m is ModelSpec => !!m);

    const filtered = this.filterByMode(candidates, mode).filter((m) =>
      this.satisfiesRequires(m, payload.requires)
    );

    if (!filtered.length) {
      throw new RoutingError("No models available for routing profile in current mode");
    }

    return filtered
      .map((m) => ({
        spec: m,
        score: (m.routingBias ?? 0) + this.capabilityScore(m, payload.requires),
      }))
      .sort((a, b) => b.score - a.score)[0].spec;
  }

  private filterByMode(models: ModelSpec[], mode: string): ModelSpec[] {
    if (mode === "local") {
      return models.filter(
        (m) => m.provider === "mock" || m.provider === "ollama" || m.provider === "local"
      );
    }
    return models;
  }

  private satisfiesRequires(m: ModelSpec, req?: ChatPayload["requires"]): boolean {
    if (!req) return true;
    if (req.toolCalls && !m.supports.toolCalls) return false;
    if (req.vision && !m.supports.vision) return false;
    if (req.streaming && !m.supports.streaming) return false;
    if (req.embeddings && !m.supports.embeddings) return false;
    return true;
  }

  private capabilityScore(m: ModelSpec, req?: ChatPayload["requires"]): number {
    if (!req) return 0;
    let score = 0;
    if (req.toolCalls && m.supports.toolCalls) score += 30;
    if (req.vision && m.supports.vision) score += 40;
    if (req.streaming && m.supports.streaming) score += 10;
    return score;
  }
}

const cloudProviderStub: Provider = {
  callChat: async () => {
    throw new RoutingError(
      "Cloud models must be dispatched through adapterGatewayAPI with routing.allowCloud=true"
    );
  },
};

const providers: Record<string, Provider> = {
  "openai-compatible": openaiCompatibleProvider,
  anthropic: anthropicProvider,
  google: googleProvider,
  ollama: ollamaProvider,
  "local-gguf": localProvider,
  "azure-openai": azureOpenAIProvider,
  "cloud-openai-compatible": cloudProviderStub,
  mock: mockProvider,
};

export async function callModel(
  payload: ChatPayload,
  agentName = "UnknownAgent",
  config: RouterConfig = {}
): Promise<ChatResult> {
  const timeoutMs = config.providerTimeoutMs ?? 30000;
  const startTime = Date.now();
  const fallbackModels = buildFallbackChain(payload.model);
  let lastError: Error | null = null;

  for (const modelName of fallbackModels) {
    try {
      const spec = getModelSpec(modelName);
      const provider = providers[spec.type];

      if (!provider) {
        lastError = new ProviderError(`No provider for type: ${spec.type}`);
        continue;
      }

      logEvent({
        eventName: "MODEL_CALL_START",
        model: spec.name,
        agent: agentName,
        fallback: modelName !== payload.model,
      });

      const result = await callWithTimeout(provider, spec, payload, timeoutMs);

      const validStructure = ResponseValidator.validateStructure(result.raw);
      if (!validStructure.valid) {
        lastError = new ProviderError(`Invalid response structure: ${validStructure.reason}`);
        continue;
      }

      const validText = ResponseValidator.validateText(result.text);
      if (!validText.valid) {
        lastError = new ProviderError(`Invalid text: ${validText.reason}`);
        continue;
      }

      const validCap = ResponseValidator.validateCapability(result.raw, payload.requires, spec);
      if (!validCap.valid) {
        lastError = new ProviderError(`Capability mismatch: ${validCap.reason}`);
        continue;
      }

      const latencyMs = Date.now() - startTime;
      logEvent({
        eventName: "MODEL_CALL_SUCCESS",
        model: spec.name,
        agent: agentName,
        latencyMs,
        tokensUsed: result.tokensUsed,
        fallback: modelName !== payload.model,
      });

      return {
        ...result,
        model: spec.name,
        fallbackUsed: modelName !== payload.model,
      };
    } catch (err: any) {
      lastError = err;
      const latencyMs = Date.now() - startTime;
      logEvent({
        eventName: "MODEL_CALL_FAILURE",
        model: modelName,
        agent: agentName,
        latencyMs,
        error: err.message ?? String(err),
        fallback: modelName !== payload.model,
      });
    }
  }

  const latencyMs = Date.now() - startTime;
  logEvent({
    eventName: "MODEL_CALL_EXHAUSTED",
    primaryModel: payload.model,
    agent: agentName,
    latencyMs,
    error: lastError?.message ?? "Unknown error",
  });

  throw lastError ?? new RoutingError(`All fallback models exhausted for ${payload.model}`);
}

async function callWithTimeout(
  provider: Provider,
  spec: ModelSpec,
  payload: ChatPayload,
  timeoutMs: number
): Promise<ChatResult> {
  return Promise.race([
    provider.callChat(spec, payload),
    new Promise<ChatResult>((_, reject) =>
      setTimeout(() => reject(new ProviderError(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

function buildFallbackChain(primaryModel: string): string[] {
  const isLocal = process.env.MAAL_MODE === "local";
  const profile = {
    preferredModels: [primaryModel],
    fallbackModels: isLocal ? ["mock"] : ["claude-3.7", "gpt-4.1", "fugu", "mock"],
  };
  return [...new Set([...profile.preferredModels, ...profile.fallbackModels])];
}
