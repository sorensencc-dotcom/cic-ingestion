#!/usr/bin/env node

/**
 * CIC Report CLI
 * Command: cic-report --cost
 * Prints cost/usage summary to stdout
 */

import { program } from 'commander';
import { generateCicCostComputeReport } from '../src/lib/report/CicCostComputeReport';
import { getAllRoutingSignals } from '../src/orchestrator/routingCostSignals';

program
  .name('cic-report')
  .description('CIC cost & usage reporting CLI')
  .version('1.0.0');

program
  .command('cost')
  .description('Print cost compute report to stdout')
  .action(() => {
    try {
      const report = generateCicCostComputeReport();

      console.log('\n╔════════════════════════════════════════════════════════════════╗');
      console.log('║          CIC Cost Compute Report                             ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      // Usage & Cost
      console.log('📊 Usage & Cost (24h)');
      console.log(`   Tokens:            ${report.usage.dailyTokens.toLocaleString()}`);
      console.log(`   Cost (USD):        $${report.cost.dailyCost.toFixed(4)}`);
      console.log(`   EMA Cost (USD):    $${report.usage.dailyTokens > 0 ? report.cost.dailyCost : 0}`);

      // Weekly
      console.log('\n📈 Weekly Totals');
      console.log(`   Tokens:            ${report.usage.weeklyTokens.toLocaleString()}`);
      console.log(`   Cost (USD):        $${report.cost.weeklyCost.toFixed(4)}`);

      // 30-day projection
      console.log('\n🔮 30-Day Projection');
      console.log(`   Tokens:            ${(report.usage.dailyProjection * 30).toLocaleString()}`);
      console.log(`   Cost (USD):        $${report.cost.dailyProjection.toFixed(2)}`);

      // Local Model ROI
      console.log('\n💰 Local Model ROI');
      console.log(`   Daily Savings:     $${report.local.dailySavings.toFixed(4)}`);
      console.log(`   GPU Cost/Day:      $${report.local.gpuCostPerDay.toFixed(4)}`);
      console.log(`   ROI Multiplier:    ${report.local.roi.toFixed(2)}x`);

      // Budget
      if (report.budget) {
        console.log('\n⚠️  Budget Status');
        console.log(`   Daily Limit:       $${report.budget.limit.toFixed(2)}`);
        console.log(`   EMA Cost:          $${report.budget.ema.toFixed(4)}`);
        console.log(`   Alert:             ${report.budget.alert ? '🔴 OVER BUDGET' : '✅ Within limits'}`);
      }

      // Agent Burn
      if (Object.keys(report.agents.burn).length > 0) {
        console.log('\n🔥 Agent Burn');
        Object.entries(report.agents.burn).forEach(([agent, data]) => {
          const savings = report.agents.savings[agent] || 0;
          console.log(`   ${agent.padEnd(20)} Tokens: ${data.tokens.toLocaleString().padStart(7)} Cost: $${data.cost.toFixed(4).padStart(8)} Savings: $${savings.toFixed(4)}`);
        });
      }

      // Routing Signals
      const signals = getAllRoutingSignals(report);
      if (signals.length > 0) {
        console.log('\n🧭 Routing Signals (MAAL Bias)');
        signals.forEach(signal => {
          const bias = signal.localBias > 0 ? `+${signal.localBias.toFixed(2)}` : '0.00';
          console.log(`   ${signal.agent.padEnd(20)} Bias: ${bias.padStart(5)} Cost/day: $${signal.costPerDay.toFixed(4)} Savings: $${signal.localSavingsPerDay.toFixed(4)}`);
        });
      }

      // Environment split
      if (report.env?.daily) {
        console.log('\n🌍 Environment Split');
        console.log(`   Dev    Tokens: ${(report.env.daily.dev?.tokens || 0).toLocaleString().padStart(7)} Cost: $${(report.env.daily.dev?.cost || 0).toFixed(4)}`);
        console.log(`   Prod   Tokens: ${(report.env.daily.prod?.tokens || 0).toLocaleString().padStart(7)} Cost: $${(report.env.daily.prod?.cost || 0).toFixed(4)}`);
      }

      console.log('\n');
      process.exit(0);
    } catch (err) {
      console.error('Error generating report:', err);
      process.exit(1);
    }
  });

program
  .command('summary')
  .description('Print brief cost summary')
  .action(() => {
    try {
      const report = generateCicCostComputeReport();
      console.log(`Daily: ${report.usage.dailyTokens} tokens, $${report.cost.dailyCost.toFixed(4)} | ROI: ${report.local.roi.toFixed(2)}x`);
      process.exit(0);
    } catch (err) {
      console.error('Error:', err);
      process.exit(1);
    }
  });

program
  .command('agents')
  .description('List agent burn rates')
  .action(() => {
    try {
      const report = generateCicCostComputeReport();
      console.log('\nAgent Burn Rates:\n');
      Object.entries(report.agents.burn)
        .sort((a, b) => b[1].cost - a[1].cost)
        .forEach(([agent, data]) => {
          console.log(`  ${agent.padEnd(20)} $${data.cost.toFixed(4)}/day`);
        });
      console.log('');
      process.exit(0);
    } catch (err) {
      console.error('Error:', err);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
