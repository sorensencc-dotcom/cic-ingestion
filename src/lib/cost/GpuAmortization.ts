/**
 * GPU Amortization & Cost Calculation
 * Daily cost: (purchasePrice / lifetimeDays) + powerCostPerDay
 */

export interface GpuCostConfig {
  purchasePrice: number;
  lifetimeDays: number;
  powerCostPerDay: number;
}

const GPU_DEFAULTS: Record<string, GpuCostConfig> = {
  '4090': {
    purchasePrice: 1600,
    lifetimeDays: 1460, // ~4 years
    powerCostPerDay: 0.85, // ~450W @ $0.12/kWh
  },
  '4080': {
    purchasePrice: 1200,
    lifetimeDays: 1460,
    powerCostPerDay: 0.72, // ~375W @ $0.12/kWh
  },
  'a100': {
    purchasePrice: 10000,
    lifetimeDays: 2190, // ~6 years for enterprise
    powerCostPerDay: 3.0, // ~250W per 8hr day
  },
};

export function getDailyGpuCost(gpuModel = '4090'): number {
  const config =
    GPU_DEFAULTS[gpuModel] ||
    GPU_DEFAULTS['4090'];

  // Override from env if set
  const purchasePrice = parseFloat(process.env.CIC_GPU_PURCHASE_PRICE ?? String(config.purchasePrice));
  const lifetimeDays = parseFloat(process.env.CIC_GPU_LIFETIME_DAYS ?? String(config.lifetimeDays));
  const powerCostPerDay = parseFloat(process.env.CIC_GPU_POWER_COST_PER_DAY ?? String(config.powerCostPerDay));

  const amortized = purchasePrice / lifetimeDays;
  return amortized + powerCostPerDay;
}
