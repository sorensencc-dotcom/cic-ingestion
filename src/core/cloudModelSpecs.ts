// Cloud provider model specifications
// To integrate: import and merge CLOUD_MODEL_SPECS into main modelSpec registry

export type CloudModelType = "cloud-openai-compatible";

export interface CloudModelSpec {
  id: string;
  type: CloudModelType;
  provider: string;
  supported: boolean;
  auth: {
    envVar: string;
    required: boolean;
  };
}

export const CLOUD_MODEL_SPECS: Record<string, CloudModelSpec> = {
  // OpenRouter models
  "openrouter:llama3-8b": {
    id: "openrouter:llama3-8b",
    type: "cloud-openai-compatible",
    provider: "openrouter",
    supported: true,
    auth: { envVar: "OPENROUTER_API_KEY", required: true },
  },
  "openrouter:llama3-70b": {
    id: "openrouter:llama3-70b",
    type: "cloud-openai-compatible",
    provider: "openrouter",
    supported: true,
    auth: { envVar: "OPENROUTER_API_KEY", required: true },
  },
  "openrouter:mistral-7b": {
    id: "openrouter:mistral-7b",
    type: "cloud-openai-compatible",
    provider: "openrouter",
    supported: true,
    auth: { envVar: "OPENROUTER_API_KEY", required: true },
  },
  "openrouter:qwen-7b": {
    id: "openrouter:qwen-7b",
    type: "cloud-openai-compatible",
    provider: "openrouter",
    supported: true,
    auth: { envVar: "OPENROUTER_API_KEY", required: true },
  },
  "openrouter:yi-34b": {
    id: "openrouter:yi-34b",
    type: "cloud-openai-compatible",
    provider: "openrouter",
    supported: true,
    auth: { envVar: "OPENROUTER_API_KEY", required: true },
  },
  "openrouter:baichuan2-13b": {
    id: "openrouter:baichuan2-13b",
    type: "cloud-openai-compatible",
    provider: "openrouter",
    supported: true,
    auth: { envVar: "OPENROUTER_API_KEY", required: true },
  },
  "openrouter:glm-4": {
    id: "openrouter:glm-4",
    type: "cloud-openai-compatible",
    provider: "openrouter",
    supported: true,
    auth: { envVar: "OPENROUTER_API_KEY", required: true },
  },
  "openrouter:kimi-k3": {
    id: "openrouter:kimi-k3",
    type: "cloud-openai-compatible",
    provider: "openrouter",
    supported: true,
    auth: { envVar: "OPENROUTER_API_KEY", required: true },
  },
  // HuggingFace models
  "huggingface:meta-llama/Llama-2-7b-hf": {
    id: "huggingface:meta-llama/Llama-2-7b-hf",
    type: "cloud-openai-compatible",
    provider: "huggingface",
    supported: true,
    auth: { envVar: "HUGGINGFACE_API_KEY", required: true },
  },
  "huggingface:mistralai/Mistral-7B-v0.1": {
    id: "huggingface:mistralai/Mistral-7B-v0.1",
    type: "cloud-openai-compatible",
    provider: "huggingface",
    supported: true,
    auth: { envVar: "HUGGINGFACE_API_KEY", required: true },
  },
  "huggingface:Qwen/Qwen-7B": {
    id: "huggingface:Qwen/Qwen-7B",
    type: "cloud-openai-compatible",
    provider: "huggingface",
    supported: true,
    auth: { envVar: "HUGGINGFACE_API_KEY", required: true },
  },
  "huggingface:01-ai/Yi-6B": {
    id: "huggingface:01-ai/Yi-6B",
    type: "cloud-openai-compatible",
    provider: "huggingface",
    supported: true,
    auth: { envVar: "HUGGINGFACE_API_KEY", required: true },
  },
  "huggingface:baichuan-inc/Baichuan-13B-Chat": {
    id: "huggingface:baichuan-inc/Baichuan-13B-Chat",
    type: "cloud-openai-compatible",
    provider: "huggingface",
    supported: true,
    auth: { envVar: "HUGGINGFACE_API_KEY", required: true },
  },
  "huggingface:THUDM/chatglm3-6b": {
    id: "huggingface:THUDM/chatglm3-6b",
    type: "cloud-openai-compatible",
    provider: "huggingface",
    supported: true,
    auth: { envVar: "HUGGINGFACE_API_KEY", required: true },
  },
  // Groq models
  "groq:llama3-8b-8192": {
    id: "groq:llama3-8b-8192",
    type: "cloud-openai-compatible",
    provider: "groq",
    supported: true,
    auth: { envVar: "GROQ_API_KEY", required: true },
  },
  "groq:llama3-70b-8192": {
    id: "groq:llama3-70b-8192",
    type: "cloud-openai-compatible",
    provider: "groq",
    supported: true,
    auth: { envVar: "GROQ_API_KEY", required: true },
  },
  "groq:mixtral-8x7b-32768": {
    id: "groq:mixtral-8x7b-32768",
    type: "cloud-openai-compatible",
    provider: "groq",
    supported: true,
    auth: { envVar: "GROQ_API_KEY", required: true },
  },
  "groq:gemma-7b-it": {
    id: "groq:gemma-7b-it",
    type: "cloud-openai-compatible",
    provider: "groq",
    supported: true,
    auth: { envVar: "GROQ_API_KEY", required: true },
  },
  // Together AI models
  "together:meta-llama/Llama-2-7b-hf": {
    id: "together:meta-llama/Llama-2-7b-hf",
    type: "cloud-openai-compatible",
    provider: "together",
    supported: true,
    auth: { envVar: "TOGETHER_API_KEY", required: true },
  },
  "together:mistralai/Mistral-7B-Instruct-v0.1": {
    id: "together:mistralai/Mistral-7B-Instruct-v0.1",
    type: "cloud-openai-compatible",
    provider: "together",
    supported: true,
    auth: { envVar: "TOGETHER_API_KEY", required: true },
  },
  "together:togethercomputer/LLaMA-2-70B-chat": {
    id: "together:togethercomputer/LLaMA-2-70B-chat",
    type: "cloud-openai-compatible",
    provider: "together",
    supported: true,
    auth: { envVar: "TOGETHER_API_KEY", required: true },
  },
  "together:NousResearch/Nous-Hermes-2-7B-DPO": {
    id: "together:NousResearch/Nous-Hermes-2-7B-DPO",
    type: "cloud-openai-compatible",
    provider: "together",
    supported: true,
    auth: { envVar: "TOGETHER_API_KEY", required: true },
  },
  "together:togethercomputer/alpaca-7b": {
    id: "together:togethercomputer/alpaca-7b",
    type: "cloud-openai-compatible",
    provider: "together",
    supported: true,
    auth: { envVar: "TOGETHER_API_KEY", required: true },
  },
  // DeepInfra models
  "deepinfra:meta-llama/Llama-2-7b-hf": {
    id: "deepinfra:meta-llama/Llama-2-7b-hf",
    type: "cloud-openai-compatible",
    provider: "deepinfra",
    supported: true,
    auth: { envVar: "DEEPINFRA_API_KEY", required: true },
  },
  "deepinfra:mistralai/Mistral-7B-Instruct-v0.1": {
    id: "deepinfra:mistralai/Mistral-7B-Instruct-v0.1",
    type: "cloud-openai-compatible",
    provider: "deepinfra",
    supported: true,
    auth: { envVar: "DEEPINFRA_API_KEY", required: true },
  },
  "deepinfra:Qwen/Qwen-7B": {
    id: "deepinfra:Qwen/Qwen-7B",
    type: "cloud-openai-compatible",
    provider: "deepinfra",
    supported: true,
    auth: { envVar: "DEEPINFRA_API_KEY", required: true },
  },
  "deepinfra:01-ai/Yi-6B": {
    id: "deepinfra:01-ai/Yi-6B",
    type: "cloud-openai-compatible",
    provider: "deepinfra",
    supported: true,
    auth: { envVar: "DEEPINFRA_API_KEY", required: true },
  },
  // Meituan models
  "meituan:meituan-llm-v1": {
    id: "meituan:meituan-llm-v1",
    type: "cloud-openai-compatible",
    provider: "meituan",
    supported: false, // Marked unsupported until real API ships
    auth: { envVar: "MEITUAN_API_KEY", required: true },
  },
};
