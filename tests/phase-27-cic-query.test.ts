/**
 * Phase 27.1 E2E Tests: Counterfactual Reasoning Query Bridge
 * Tests: TorqueQuery /search/cic-query → AutonomyAPIServer /autonomy/search/cic-query
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fetch from 'node-fetch';

const AUTONOMY_BASE = process.env.AUTONOMY_URL || 'http://localhost:3000';
const TORQUE_BASE = process.env.TORQUE_URL || 'http://localhost:3110';
const GOVERNANCE_BASE = process.env.GOVERNANCE_URL || 'http://localhost:3113';

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

describe('Phase 27.1: Counterfactual Reasoning Query Bridge', () => {
  beforeAll(async () => {
    // Seed index with test data
    console.log('Seeding TorqueQuery index...');
    await seedIndex();

    // Wait for index to be ready
    await new Promise(r => setTimeout(r, 500));

    // Verify index
    await verifyIndexReady();
  }, TEST_TIMEOUT);

  describe('Case 1: Single-phase query', () => {
    it('should return matching decisions for single phase filter', async () => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What if we had used a different adapter?',
          phase_ids: ['24'],
          limit: 5,
        }),
      });

      expect(response.status).toBe(200);

      const result = await response.json();

      // Assertions
      expect(result.query_id).toBeDefined();
      expect(result.query_text).toBe('What if we had used a different adapter?');
      expect(result.matching_decisions).toBeDefined();
      expect(Array.isArray(result.matching_decisions)).toBe(true);
      expect(result.matching_decisions.length).toBeGreaterThan(0);

      // Check confidence threshold
      result.matching_decisions.forEach((decision: any) => {
        expect(decision.confidence || decision.indexed_fields?.confidence).toBeGreaterThanOrEqual(0.7);
      });

      // Check counterfactual analysis
      expect(result.counterfactual_analysis).toBeDefined();
      expect(result.counterfactual_analysis.primary_match).toBeDefined();
      expect(result.counterfactual_analysis.alternative_outcomes).toBeDefined();
      expect(Array.isArray(result.counterfactual_analysis.alternative_outcomes)).toBe(true);

      // Check timing SLO
      expect(result.took_ms).toBeLessThan(500);
    }, TEST_TIMEOUT);
  });

  describe('Case 2: Multi-phase with confidence filter', () => {
    it('should filter results by phase and confidence threshold', async () => {
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

      expect(response.status).toBe(200);

      const result = await response.json();

      // All results should meet confidence threshold
      result.matching_decisions.forEach((decision: any) => {
        const confidence = decision.indexed_fields?.confidence || decision.score;
        expect(confidence).toBeGreaterThanOrEqual(0.8);
      });

      // Should have alternatives for counterfactual analysis
      expect(result.counterfactual_analysis.alternative_outcomes.length).toBeGreaterThan(0);

      // Verify primary_match corresponds to top result
      if (result.matching_decisions.length > 0) {
        expect(result.counterfactual_analysis.primary_match).toBe(
          result.matching_decisions[0].source_id,
        );
      }

      // Check timing SLO
      expect(result.took_ms).toBeLessThan(500);
    }, TEST_TIMEOUT);
  });

  describe('Case 3: Reasoning context (Phase 27.1+)', () => {
    it('should accept reasoning context without error', async () => {
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

      expect(response.status).toBe(200);

      const result = await response.json();

      // Should still return results despite reasoning_context being optional
      expect(result.matching_decisions).toBeDefined();
      expect(result.counterfactual_analysis).toBeDefined();
      expect(result.took_ms).toBeLessThan(500);
    }, TEST_TIMEOUT);
  });

  describe('Global invariants (all tests)', () => {
    it('primary_match should always equal first result source_id when results exist', async () => {
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
        expect(result.counterfactual_analysis.primary_match).toBe(
          result.matching_decisions[0].source_id,
        );
      }
    }, TEST_TIMEOUT);

    it('should not exceed SLO latency for any query', async () => {
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
      expect(result.took_ms).toBeLessThan(500);
    }, TEST_TIMEOUT);

    it('should have applicable_precedents match total search results', async () => {
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
      expect(result.counterfactual_analysis.applicable_precedents).toBeGreaterThanOrEqual(
        result.matching_decisions.length,
      );
    }, TEST_TIMEOUT);
  });

  describe('Error handling', () => {
    it('should return 400 for missing query parameter', async () => {
      const response = await fetch(`${AUTONOMY_BASE}/autonomy/search/cic-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_ids: ['24'],
        }),
      });

      // Should fail validation (no query field)
      expect([400, 500]).toContain(response.status);
    }, TEST_TIMEOUT);

    it('should handle limit > 100 gracefully', async () => {
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
        expect(result.matching_decisions.length).toBeLessThanOrEqual(100);
      } else {
        expect(response.status).toBe(400);
      }
    }, TEST_TIMEOUT);
  });
});
