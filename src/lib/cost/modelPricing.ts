/**
 * Model Pricing Table
 * Current rates (USD per 1M tokens)
 */

export const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-opus-4-8': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
};

export function computeCost(model: string, tokensIn: number, tokensOut: number): number {
  const rate = MODEL_RATES[model];
  if (!rate) return 0;
  return ((tokensIn * rate.input) + (tokensOut * rate.output)) / 1_000_000;
}
