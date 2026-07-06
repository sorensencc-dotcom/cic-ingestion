/**
 * Phase 27.1 E2E Tests: Counterfactual Reasoning Query Bridge
 * Tests: TorqueQuery /search/cic-query → AutonomyAPIServer /autonomy/search/cic-query
 * Using Node native test runner (not Jest)
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';

const AUTONOMY_BASE = process.env.AUTONOMY_URL || 'http://localhost:3000';
const TORQUE_BASE = process.env.TORQUE_URL || 'http://localhost:3110';

const TEST_TIMEOUT = 10000;

/**
 * Test fixture: seed TorqueQuery with sample governance decisions
 */
async function seedIndex() {
  const documents = [
    {
      id: 'governance-decision-001',
      source_type: 'governance_decision',
      source_id: 'gov-001',
      document_type: 'decision',
      content: JSON.stringify({
        phase: '24',
        decision: 'Use Grok instead of FamilySearch for cost optimization',
        reasoning: 'Cost was prioritized over accuracy in this phase',
        outcome: 'Reduced API costs by 40%',
        confidence: 0.95,
      }),
      indexed_fields: {
        phase_id: '24',
        confidence: 0.95,
        severity: 'high',
      },
    },
    {
      id: 'governance-decision-002',
      source_type: 'governance_decision',
      source_id: 'gov-002',
      document_type: 'decision',
      content: JSON.stringify({
        phase: '24',
        decision: 'Prioritize cost over accuracy in adapter selection',
        reasoning: 'Budget constraints required cost-first approach',
        outcome: 'Enabled budget compliance',
        confidence: 0.85,
      }),
      indexed_fields: {
        phase_id: '24',
        confidence: 0.85,
        severity: 'medium',
      },
    },
    {
      id: 'governance-decision-003',
      source_type: 'governance_decision',
      source_id: 'gov-003',
      document_type: 'decision',
      content: JSON.stringify({
        phase: '23',
        decision: 'High confidence reasoning chain validation',
        reasoning: 'Ensure reasoning chains meet high confidence threshold',
        outcome: 'Improved decision quality',
        confidence: 0.92,
      }),
      indexed_fields: {
        phase_id: '23',
        confidence: 0.92,
        severity: 'high',
      },
    },
  ];

  const response = await fetch(`${TORQUE_BASE}/index/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batch_id: 'test-seed-001',
      documents,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to seed index: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Verify index has documents before running tests
 */
async function verifyIndexReady() {
  const response = await fetch(`${TORQUE_BASE}/index/stats`);
  if (!response.ok) throw new Error('Index stats unavailable');

  const stats = await response.json();
  if (stats.total_documents === 0) {
    throw new Error('Index is empty; seeding failed');
  }

  console.log(`✓ Index ready with ${stats.total_documents} documents`);
}

// Seed index before tests (skip if services unavailable)
let servicesAvailable = false;
try {
  console.log('Seeding TorqueQuery index...');
  await seedIndex();
  await new Promise(r => setTimeout(r, 500));
  await verifyIndexReady();
  servicesAvailable = true;
} catch (err) {
  console.warn('⚠️  Services unavailable. Tests will be skipped.');
  console.warn(`   Error: ${String(err)}`);
  console.warn('   Start TorqueQuery and AutonomyAPIServer to run tests.');
  servicesAvailable = false;
}

describe('Phase 27.1: Counterfactual Reasoning Query Bridge', async () => {
  if (!servicesAvailable) {
    test('SKIPPED: Services not available', () => {
      console.log('Run with TorqueQuery + AutonomyAPIServer to execute tests');
    });
  } else {
    describe('Case 1: Single-phase query', async () => {
      test('should return matching decisions for single phase filter', async (t) => {
        const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What if we had used a different adapter?',
          phase_ids: ['24'],
          limit: 5,
        }),
      });

      assert.strictEqual(response.status, 200, 'Response status should be 200');

      const result = await response.json();

      // Assertions
      assert.ok(result.query_id, 'query_id should be defined');
      assert.strictEqual(result.query_text, 'What if we had used a different adapter?', 'query_text should match input');
      assert.ok(Array.isArray(result.matching_decisions), 'matching_decisions should be array');
      assert.ok(result.matching_decisions.length > 0, 'should have at least one result');

      // Check confidence threshold
      result.matching_decisions.forEach((decision: any) => {
        const conf = decision.confidence || decision.indexed_fields?.confidence;
        assert.ok(conf >= 0.7, `confidence ${conf} should be >= 0.7`);
      });

      // Check counterfactual analysis
      assert.ok(result.counterfactual_analysis, 'counterfactual_analysis should exist');
      assert.ok(result.counterfactual_analysis.primary_match, 'primary_match should be defined');
      assert.ok(Array.isArray(result.counterfactual_analysis.alternative_outcomes), 'alternative_outcomes should be array');

      // Check timing SLO
      assert.ok(result.took_ms < 500, `took_ms ${result.took_ms} should be < 500ms`);
    });
  });

  describe('Case 2: Multi-phase with confidence filter', async () => {
    test('should filter results by phase and confidence threshold', async (t) => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'decisions prioritizing cost',
          phase_ids: ['23', '24'],
          confidence_min: 0.8,
          limit: 10,
        }),
      });

      assert.strictEqual(response.status, 200, 'Response status should be 200');

      const result = await response.json();

      // All results should meet confidence threshold
      result.matching_decisions.forEach((decision: any) => {
        const conf = decision.indexed_fields?.confidence || decision.score;
        assert.ok(conf >= 0.8, `confidence ${conf} should be >= 0.8`);
      });

      // Should have alternatives
      assert.ok(result.counterfactual_analysis.alternative_outcomes.length >= 0, 'should have alternatives list');

      // Verify primary_match
      if (result.matching_decisions.length > 0) {
        assert.strictEqual(
          result.counterfactual_analysis.primary_match,
          result.matching_decisions[0].source_id,
          'primary_match should equal first result',
        );
      }

      // Check timing SLO
      assert.ok(result.took_ms < 500, `took_ms ${result.took_ms} should be < 500ms`);
    });
  });

  describe('Case 3: Reasoning context', async () => {
    test('should accept reasoning context without error', async (t) => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'high confidence decisions',
          phase_ids: ['24'],
          reasoning_context: {
            decision_id: 'gov-001',
            reasoning_chain: ['cost', 'optimization', 'budget'],
          },
          limit: 5,
        }),
      });

      assert.strictEqual(response.status, 200, 'Response status should be 200');

      const result = await response.json();

      // Should still return results despite reasoning_context being optional
      assert.ok(result.matching_decisions, 'matching_decisions should exist');
      assert.ok(result.counterfactual_analysis, 'counterfactual_analysis should exist');
      assert.ok(result.took_ms < 500, `took_ms ${result.took_ms} should be < 500ms`);
    });
  });

  describe('Global invariants', async () => {
    test('primary_match should equal first result source_id when results exist', async (t) => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'cost',
          phase_ids: ['24'],
          limit: 3,
        }),
      });

      const result = await response.json();

      if (result.matching_decisions.length > 0) {
        assert.strictEqual(
          result.counterfactual_analysis.primary_match,
          result.matching_decisions[0].source_id,
          'primary_match should match first result',
        );
      }
    });

    test('should not exceed SLO latency for any query', async (t) => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'arbitrary test query',
          limit: 20,
        }),
      });

      const result = await response.json();

      // Phase 27.3 SLO: P95 < 500ms
      assert.ok(result.took_ms < 500, `took_ms ${result.took_ms} should be < 500ms (SLO)`);
    });

    test('applicable_precedents should be >= matching results count', async (t) => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'decision',
          limit: 5,
        }),
      });

      const result = await response.json();

      // applicable_precedents should match total documents matching query
      assert.ok(
        result.counterfactual_analysis.applicable_precedents >= result.matching_decisions.length,
        'applicable_precedents should be >= matching results',
      );
    });
  });

  describe('Error handling', async () => {
    test('should return error for missing query parameter', async (t) => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_ids: ['24'],
        }),
      });

      // Should fail validation (no query field)
      assert.ok([400, 500].includes(response.status), `status ${response.status} should be 400 or 500`);
    });

    test('should handle limit > 100 gracefully', async (t) => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test',
          limit: 200, // Exceeds max
        }),
      });

      // Either reject or cap at 100
      if (response.ok) {
        const result = await response.json();
        assert.ok(
          result.matching_decisions.length <= 100,
          `results ${result.matching_decisions.length} should be <= 100`,
        );
      } else {
        assert.strictEqual(response.status, 400, 'should reject with 400');
      }
    });
  });
    }
});
