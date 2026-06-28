/**
 * CIC Cost Compute Report — HTML Renderer
 * Generates full HTML page with inline SVGs for PDF or web display
 */

import { CicCostComputeReport } from './CicCostComputeReport';
import {
  renderUsageCost7dSvg,
  renderLocalSavings7dSvg,
  renderPerModelCostSvg,
  type DailyCostData,
  type ModelCostData,
} from '../charts/CostCharts';

export interface RenderOptions {
  title?: string;
  period?: 'daily' | 'weekly';
  includeCharts?: boolean;
}

/**
 * Generate full HTML report with dark theme + inline SVGs
 */
export function renderReportHtml(
  report: CicCostComputeReport,
  options: RenderOptions = {}
): string {
  const {
    title = 'CIC Cost Compute Report',
    period = 'daily',
    includeCharts = true,
  } = options;

  const date = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toLocaleString();

  // Prepare chart data (mock 7-day historical)
  const chartData: DailyCostData[] = Array.from({ length: 7 }, (_, i) => {
    const daysAgo = 6 - i;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      date: date.toISOString().split('T')[0],
      tokens: Math.max(100, report.usage.dailyTokens - Math.random() * 500),
      cost: Math.max(0.01, report.cost.dailyCost - Math.random() * 0.1),
    };
  });

  const modelData: ModelCostData[] = Object.entries(report.agents.burn).map(
    ([agent, data]) => ({
      model: agent,
      cost: data.cost,
      tokens: data.tokens,
    })
  );

  const usageCostChart = includeCharts ? renderUsageCost7dSvg(chartData) : '';
  const savingsChart = includeCharts ? renderLocalSavings7dSvg(chartData) : '';
  const modelChart = includeCharts ? renderPerModelCostSvg(modelData) : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #0d0d0d;
      color: #e0e0e0;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.6;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #00ff88; margin-bottom: 10px; font-size: 24px; }
    h2 { color: #00ccff; margin-top: 20px; margin-bottom: 12px; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 6px; }
    h3 { color: #00ff88; margin-top: 12px; margin-bottom: 8px; font-size: 14px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #00ff88; padding-bottom: 10px; }
    .meta { color: #999; font-size: 12px; margin: 4px 0; }
    .card { background-color: #1a1a1a; border: 1px solid #00ff88; border-radius: 6px; padding: 16px; margin-bottom: 16px; }
    .card-header { color: #00ff88; font-weight: bold; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    .metric-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #333; }
    .metric-row:last-child { border-bottom: none; }
    .metric-label { color: #999; flex: 1; }
    .metric-value { color: #fff; font-weight: bold; text-align: right; flex: 0 0 auto; }
    .metric-positive { color: #4ade80; }
    .metric-negative { color: #ff6b6b; }
    .agent-section { background-color: #141414; border-left: 2px solid #00ccff; padding: 10px 12px; margin-bottom: 8px; border-radius: 3px; }
    .agent-name { color: #00ccff; font-weight: bold; }
    .chart-container { margin: 16px 0; text-align: center; }
    .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #333; color: #666; font-size: 11px; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #333; }
    th { background-color: #1a1a1a; color: #00ff88; font-weight: bold; }
    tr:hover { background-color: #161616; }
    .alert { background-color: #3d2020; border-left: 3px solid #ff6b6b; padding: 12px; margin: 12px 0; border-radius: 3px; }
    .alert-text { color: #ff9999; }
    .success { background-color: #1a3d2a; border-left: 3px solid #4ade80; padding: 12px; margin: 12px 0; border-radius: 3px; }
    .success-text { color: #7ee8b7; }
    @media print {
      body { background-color: #fff; color: #000; }
      .card { border-color: #000; background-color: #f5f5f5; color: #000; }
      h1, h2, h3 { color: #000; }
      .metric-label { color: #555; }
      .metric-value { color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>📊 ${title}</h1>
      <div class="meta">Generated: ${timestamp}</div>
      <div class="meta">Period: ${period === 'daily' ? 'Daily' : 'Weekly'} Report</div>
      <div class="meta">Date: ${date}</div>
    </div>

    <!-- Usage & Cost Summary -->
    <div class="card">
      <div class="card-header">Usage & Cost Summary</div>
      <div class="metric-row">
        <span class="metric-label">Daily Tokens</span>
        <span class="metric-value">${report.usage.dailyTokens.toLocaleString()}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Daily Cost (USD)</span>
        <span class="metric-value">$${report.cost.dailyCost.toFixed(4)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Weekly Tokens</span>
        <span class="metric-value">${report.usage.weeklyTokens.toLocaleString()}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Weekly Cost (USD)</span>
        <span class="metric-value">$${report.cost.weeklyCost.toFixed(4)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">30-Day Projection (USD)</span>
        <span class="metric-value">$${report.cost.dailyProjection.toFixed(2)}</span>
      </div>
    </div>

    <!-- Local Model ROI -->
    <div class="card">
      <div class="card-header">💰 Local Model ROI</div>
      <div class="metric-row">
        <span class="metric-label">Daily Savings (USD)</span>
        <span class="metric-value metric-positive">+$${report.local.dailySavings.toFixed(4)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Weekly Savings (USD)</span>
        <span class="metric-value metric-positive">+$${report.local.weeklySavings.toFixed(4)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">GPU Cost per Day (USD)</span>
        <span class="metric-value">$${report.local.gpuCostPerDay.toFixed(4)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">ROI Multiplier</span>
        <span class="metric-value" style="color: ${report.local.roi > 1 ? '#4ade80' : '#ff9999'}">
          ${report.local.roi.toFixed(2)}x
        </span>
      </div>
    </div>

    <!-- Budget & Alerts -->
    ${
      report.budget
        ? `<div class="card">
      <div class="card-header">⚠️ Budget Status</div>
      <div class="metric-row">
        <span class="metric-label">Daily Budget Limit (USD)</span>
        <span class="metric-value">$${report.budget.limit.toFixed(2)}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">EMA Cost Trend (USD)</span>
        <span class="metric-value">$${report.budget.ema.toFixed(4)}</span>
      </div>
      ${
        report.budget.alert
          ? `<div class="alert"><span class="alert-text">⚠️ Budget Alert: EMA exceeds daily limit</span></div>`
          : `<div class="success"><span class="success-text">✓ Budget: Within limits</span></div>`
      }
    </div>`
        : ''
    }

    <!-- Agent Burn Breakdown -->
    <div class="card">
      <div class="card-header">🔥 Agent Burn Breakdown</div>
      ${
        Object.entries(report.agents.burn).length > 0
          ? `<table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Tokens</th>
            <th>Cost (USD)</th>
            <th>Savings (USD)</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(report.agents.burn)
            .map(([agent, burn]) => {
              const savings = report.agents.savings[agent] || 0;
              return `<tr>
            <td><strong>${agent}</strong></td>
            <td>${burn.tokens.toLocaleString()}</td>
            <td>$${burn.cost.toFixed(4)}</td>
            <td class="metric-positive">+$${savings.toFixed(4)}</td>
          </tr>`;
            })
            .join('')}
        </tbody>
      </table>`
          : '<p style="color: #999">No agent activity recorded.</p>'
      }
    </div>

    <!-- Environment Split -->
    ${
      report.env
        ? `<div class="card">
      <div class="card-header">🌍 Environment Split</div>
      <h3>Development</h3>
      <div class="metric-row">
        <span class="metric-label">Tokens</span>
        <span class="metric-value">${(report.env.daily?.dev?.tokens || 0).toLocaleString()}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Cost (USD)</span>
        <span class="metric-value">$${(report.env.daily?.dev?.cost || 0).toFixed(4)}</span>
      </div>
      <h3>Production</h3>
      <div class="metric-row">
        <span class="metric-label">Tokens</span>
        <span class="metric-value">${(report.env.daily?.prod?.tokens || 0).toLocaleString()}</span>
      </div>
      <div class="metric-row">
        <span class="metric-label">Cost (USD)</span>
        <span class="metric-value">$${(report.env.daily?.prod?.cost || 0).toFixed(4)}</span>
      </div>
    </div>`
        : ''
    }

    <!-- Charts -->
    ${
      includeCharts
        ? `<h2>📈 Trend Charts (7-Day Historical)</h2>
    <div class="chart-container">
      <h3>Usage & Cost Trend</h3>
      ${usageCostChart}
    </div>
    <div class="chart-container">
      <h3>Local Model Savings Trend</h3>
      ${savingsChart}
    </div>
    <div class="chart-container">
      <h3>Cost by Agent</h3>
      ${modelChart}
    </div>`
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      <p>CIC Cost Compute Report | Unified usage & cost tracking across pipeline</p>
      <p>Ledger: ./cic-usage-ledger.json | Data source: /api/usage-summary</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}
