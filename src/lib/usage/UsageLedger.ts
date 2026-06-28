/**
 * Usage & Cost Ledger
 * Append-only JSON ledger tracking all LLM calls with tokens, cost, and metadata
 */

import fs from 'fs';
import path from 'path';

export interface LedgerEntry {
  ts: string;         // ISO timestamp
  model: string;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  cost: number;       // USD
  source: string;     // e.g. "cic-ingest", "cic-orchestrate"
  stage: string;      // e.g. "ORCHESTRATE→SYNTHESIZE"
  agent: string;      // e.g. "researcher"
  jobId?: string;
  local: boolean;     // true = local model, cost = 0
  env?: 'dev' | 'prod';
}

export interface DailySummary {
  dailyTokens: number;
  dailyCost: number;
  dailySavings: number;
  weeklyTokens: number;
  weeklyCost: number;
  weeklySavings: number;
  emaTokens: number;
  emaCost: number;
  byStage: Record<string, number>;
  byAgent: Record<string, { tokens: number; cost: number; savings: number }>;
}

class UsageLedgerClass {
  private ledgerPath: string;

  constructor() {
    this.ledgerPath = path.join(process.cwd(), 'cic-usage-ledger.json');
  }

  private ensureLedger(): void {
    if (!fs.existsSync(this.ledgerPath)) {
      fs.writeFileSync(this.ledgerPath, JSON.stringify({ entries: [] }, null, 2));
    }
  }

  log(entry: LedgerEntry): void {
    this.ensureLedger();
    const data = JSON.parse(fs.readFileSync(this.ledgerPath, 'utf-8'));
    data.entries.push(entry);
    fs.writeFileSync(this.ledgerPath, JSON.stringify(data, null, 2));
  }

  private readEntries(): LedgerEntry[] {
    this.ensureLedger();
    const data = JSON.parse(fs.readFileSync(this.ledgerPath, 'utf-8'));
    return data.entries || [];
  }

  getDailySummary(): DailySummary {
    const entries = this.readEntries();
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    const cutoff24h = new Date(now.getTime() - day);
    const cutoff7d = new Date(now.getTime() - week);

    const daily = entries.filter(e => new Date(e.ts).getTime() >= cutoff24h.getTime());
    const weekly = entries.filter(e => new Date(e.ts).getTime() >= cutoff7d.getTime());

    const dailyTokens = daily.reduce((sum, e) => sum + e.totalTokens, 0);
    const dailyCost = daily.reduce((sum, e) => sum + e.cost, 0);
    const dailySavings = daily.filter(e => e.local).reduce((sum, e) => sum + e.cost, 0);

    const weeklyTokens = weekly.reduce((sum, e) => sum + e.totalTokens, 0);
    const weeklyCost = weekly.reduce((sum, e) => sum + e.cost, 0);
    const weeklySavings = weekly.filter(e => e.local).reduce((sum, e) => sum + e.cost, 0);

    const emaTokens = this.getEMA(daily, 'totalTokens');
    const emaCost = this.getEMA(daily, 'cost');

    const byStage: Record<string, number> = {};
    daily.forEach(e => {
      byStage[e.stage] = (byStage[e.stage] || 0) + e.totalTokens;
    });

    const byAgent: Record<string, { tokens: number; cost: number; savings: number }> = {};
    daily.forEach(e => {
      if (!byAgent[e.agent]) {
        byAgent[e.agent] = { tokens: 0, cost: 0, savings: 0 };
      }
      byAgent[e.agent].tokens += e.totalTokens;
      byAgent[e.agent].cost += e.cost;
      if (e.local) {
        byAgent[e.agent].savings += e.cost;
      }
    });

    return {
      dailyTokens,
      dailyCost,
      dailySavings,
      weeklyTokens,
      weeklyCost,
      weeklySavings,
      emaTokens,
      emaCost,
      byStage,
      byAgent,
    };
  }

  private getEMA(entries: LedgerEntry[], field: 'totalTokens' | 'cost', alpha = 0.3): number {
    if (entries.length === 0) return 0;
    let ema = 0;
    entries.forEach(e => {
      const val = field === 'totalTokens' ? e.totalTokens : e.cost;
      ema = alpha * val + (1 - alpha) * ema;
    });
    return ema;
  }

  getProjection(days = 30): { tokens: number; cost: number } {
    const summary = this.getDailySummary();
    return {
      tokens: summary.emaTokens * days,
      cost: summary.emaCost * days,
    };
  }
}

export const UsageLedger = new UsageLedgerClass();
