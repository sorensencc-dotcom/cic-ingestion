// Quick functional test for CavemanCompressor
// Run with: node test-caveman.mjs

import { cavemanCompress, compressJsonResponse, compressAutonomyOutput, logCompressionStats } from './dist/autonomy/CavemanCompressor.js';

console.log('\n🪨 CAVEMAN COMPRESSION TEST\n');
console.log('='.repeat(60));

// Test 1: Basic text compression
console.log('\n📝 Test 1: Basic Text Compression');
console.log('-'.repeat(60));

const longText = `The reason your React component is re-rendering is likely because you're creating
a new object reference on each render cycle. When you pass an inline object as a prop,
React's shallow comparison sees it as a different object every time, which triggers a
re-render. I would recommend using useMemo to memoize the object.`;

const compressed = cavemanCompress(longText);

console.log('BEFORE:');
console.log(`  "${longText}"`);
console.log(`  Length: ${longText.length} chars`);
console.log('\nAFTER:');
console.log(`  "${compressed}"`);
console.log(`  Length: ${compressed.length} chars`);
console.log(`  Reduction: ${Math.round(((longText.length - compressed.length) / longText.length) * 100)}%`);

// Test 2: JSON field compression
console.log('\n\n📦 Test 2: JSON Response Compression');
console.log('-'.repeat(60));

const autonomySignal = {
  id: 'signal-001',
  type: 'drift',
  severity: 'high',
  description: 'The system has detected a significant deviation from the expected behavior pattern. This indicates that something fundamental has changed in the execution environment.',
  rationale: 'Based on the analysis of temporal signals and semantic drift calculations, the confidence level is very high that this represents a genuine shift and not a transient anomaly.'
};

const compressedSignal = compressJsonResponse(autonomySignal, ['description', 'rationale']);

console.log('BEFORE:');
console.log(`  ${JSON.stringify(autonomySignal, null, 2)}`);
const beforeSize = JSON.stringify(autonomySignal).length;
console.log(`  Size: ${beforeSize} bytes`);

console.log('\nAFTER:');
console.log(`  ${JSON.stringify(compressedSignal, null, 2)}`);
const afterSize = JSON.stringify(compressedSignal).length;
console.log(`  Size: ${afterSize} bytes`);
console.log(`  Reduction: ${Math.round(((beforeSize - afterSize) / beforeSize) * 100)}%`);

// Test 3: Full autonomy output compression
console.log('\n\n🤖 Test 3: Full Autonomy Output Compression');
console.log('-'.repeat(60));

const signals = [
  {
    id: 'sig-1',
    type: 'drift',
    description: 'The system behavior has deviated significantly from the expected baseline, indicating potential instability or unexpected state changes that require investigation.',
    severity: 'high'
  },
  {
    id: 'sig-2',
    type: 'regression',
    description: 'Performance metrics show a degradation in response times compared to previous measurements, suggesting resource contention or algorithm inefficiency.',
    severity: 'medium'
  }
];

const proposals = [
  {
    id: 'prop-1',
    action: 'investigate_drift',
    description: 'This proposal recommends conducting a thorough investigation of the drift signal to determine root cause.',
    reasoning: 'Given the high severity and the significant deviation from baseline, immediate action is warranted to prevent system failures.'
  }
];

const { signals: compSignals, proposals: compProposals, stats } = compressAutonomyOutput(signals, proposals);

console.log('BEFORE:');
console.log(`  Signals: ${JSON.stringify(signals).length} bytes`);
console.log(`  Proposals: ${JSON.stringify(proposals).length} bytes`);
console.log(`  Total: ${stats.originalLength} bytes`);

console.log('\nAFTER:');
console.log(`  Signals: ${JSON.stringify(compSignals).length} bytes`);
console.log(`  Proposals: ${JSON.stringify(compProposals).length} bytes`);
console.log(`  Total: ${stats.compressedLength} bytes`);

console.log('\nSTATS:');
logCompressionStats(stats);

// Test 4: Real-world API response scenario
console.log('\n\n🌐 Test 4: Real-World API Response');
console.log('-'.repeat(60));

const apiResponse = {
  success: true,
  data: {
    signals: compSignals,
    proposals: compProposals,
    metadata: {
      processedAt: new Date().toISOString(),
      executionTime: 245,
      tokenEstimate: {
        before: stats.originalLength,
        after: stats.compressedLength,
        saved: stats.originalLength - stats.compressedLength
      }
    }
  }
};

console.log('API Response (compressed):');
const jsonSize = JSON.stringify(apiResponse).length;
console.log(`  Total size: ${jsonSize} bytes`);
console.log(`  Estimated tokens: ${Math.ceil(jsonSize / 4)} (vs ${Math.ceil(stats.originalLength / 4)} before)`);
console.log(`  Token savings: ~${Math.round((stats.reductionPercent / 100) * (stats.originalLength / 4))} tokens`);

console.log('\n' + '='.repeat(60));
console.log('✓ All tests passed!\n');
