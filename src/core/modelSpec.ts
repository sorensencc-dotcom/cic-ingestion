export type ModelType =
  | "openai-compatible"
  | "anthropic"
  | "google"
  | "ollama"
  | "local-gguf"
  | "azure-openai"
  | "cloud-openai-compatible"
  | "mock";

export interface ModelCapabilities {
  chat: boolean;
  toolCalls: boolean;
  streaming: boolean;
  vision: boolean;
  embeddings: boolean;
}

export interface ModelSpec {
  name: string;
  provider: string;
  type: ModelType;
  apiBase: string;
  env: string;
  maxTokens?: number;
  pricing?: {
    input?: number;
    output?: number;
  };
  supports: ModelCapabilities;
  routing?: {
    score: number;
    domains?: string[];
  };
  routingBias?: number;
}
