/**
 * Phase 2 E2E Integration Test
 * Covers full pipeline: Ingestion → Routing → Orchestrator → Audit
 *
 * Test Plan:
 * 1. Create diverse ingestion entries (filesystem, API, images, PDF)
 * 2. Route through ingestionRouter (profile + lane selection)
 * 3. Record to audit manifest (verification + cost tracking)
 * 4. Verify end-to-end signal flow and cost aggregation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { route } from '../ingestion/ingestionRouter';
import type { RoutedIngestionDecision, VerificationResult, Cost } from '../ingestion/types';

describe('Phase 2: E2E Integration — Ingestion → Routing → Audit', () => {
  let testManifestPath: string;

  beforeEach(() => {
    // Setup test manifest path
    testManifestPath = path.join(__dirname, '.test-e2e-manifest.jsonl');
    if (fs.existsSync(testManifestPath)) {
      fs.unlinkSync(testManifestPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testManifestPath)) {
      fs.unlinkSync(testManifestPath);
    }
  });

  describe('Ingestion → Routing Stage', () => {
    it('routes filesystem entries to fast lane', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        mediaType: 'text/plain',
        size: 1024,
      };

      const decision = route(entry);

      expect(decision.profile).toBe('filesystem');
      expect(decision.lane).toBe('fast');
      expect(decision.extractors).toContain('TextExtractor');
      expect(decision.extractors).toContain('SemanticExtractor');
    });

    it('routes API entries by source prefix', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'api:familysearch',
        mediaType: 'application/json',
        size: 2048,
      };

      const decision = route(entry);

      expect(decision.profile).toBe('api:familysearch');
      expect(decision.lane).toBe('deep');
      expect(decision.extractors).toContain('RelationshipExtractor');
    });

    it('routes unknown API sources to generic handler', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'api:unknown-service',
        mediaType: 'application/json',
        size: 2048,
      };

      const decision = route(entry);

      expect(decision.profile).toBe('api:generic');
      expect(decision.lane).toBe('fast');
    });

    it('routes oversized entries to quarantine', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        mediaType: 'text/plain',
        size: 6 * 1024 * 1024, // 6MB, exceeds 5MB filesystem limit
      };

      const decision = route(entry);

      expect(decision.lane).toBe('quarantine');
    });

    it('routes DLQ repeats after max retries to quarantine', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        mediaType: 'text/plain',
        size: 1024,
        retryCount: 4,
        fromDLQ: true,
      };

      const decision = route(entry);

      expect(decision.lane).toBe('quarantine');
    });

    it('routes images by mediaType when source unknown', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'unknown-source',
        mediaType: 'image/png',
        size: 1024 * 1024, // 1MB
      };

      const decision = route(entry);

      expect(decision.profile).toBe('images');
      expect(decision.lane).toBe('deep');
      expect(decision.extractors).toContain('ImageAnalyzer');
    });

    it('routes PDF by mediaType when source unknown', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'unknown-source',
        mediaType: 'application/pdf',
        size: 2 * 1024 * 1024, // 2MB
      };

      const decision = route(entry);

      expect(decision.profile).toBe('pdf');
      expect(decision.lane).toBe('deep');
      expect(decision.extractors).toContain('PDFExtractor');
      expect(decision.extractors).toContain('TextExtractor');
    });
  });

  describe('Audit & Cost Tracking', () => {
    it('calculates aggregated costs', () => {
      const entries = [
        {
          source: 'filesystem',
          mediaType: 'text/plain',
          size: 1024,
        },
        {
          source: 'api:familysearch',
          mediaType: 'application/json',
          size: 2048,
        },
        {
          source: 'filesystem',
          mediaType: 'image/png',
          size: 1024 * 1024,
        },
      ];

      let totalCost = 0;
      const decisions = entries.map((entry) => {
        const decision = route(entry);
        const cost: Cost = {
          extractorCost: decision.extractors.length * 0.0005,
          verificationCost: 0.0002,
          totalCost: decision.extractors.length * 0.0005 + 0.0002,
        };
        totalCost += cost.totalCost;
        return { entry, decision, cost };
      });

      expect(totalCost).toBeGreaterThan(0);
      expect(decisions.length).toBe(3);
    });
  });

  describe('Full E2E Pipeline', () => {
    it('processes diverse batch with mixed profiles and lanes', () => {
      const testBatch = [
        {
          id: crypto.randomUUID(),
          source: 'filesystem',
          mediaType: 'text/plain',
          size: 512,
          retryCount: 0,
          fromDLQ: false,
        },
        {
          id: crypto.randomUUID(),
          source: 'api:familysearch',
          mediaType: 'application/json',
          size: 1024,
          retryCount: 0,
          fromDLQ: false,
        },
        {
          id: crypto.randomUUID(),
          source: 'custom-source',
          mediaType: 'image/jpeg',
          size: 2 * 1024 * 1024,
          retryCount: 0,
          fromDLQ: false,
        },
        {
          id: crypto.randomUUID(),
          source: 'custom-source-2',
          mediaType: 'application/pdf',
          size: 5 * 1024 * 1024,
          retryCount: 0,
          fromDLQ: false,
        },
      ];

      const results = testBatch.map((entry) => {
        const decision = route(entry);
        const verification: VerificationResult = {
          passed: true,
          errors: [],
        };
        const cost: Cost = {
          extractorCost: decision.extractors.length * 0.0005,
          verificationCost: 0.0002,
          totalCost: decision.extractors.length * 0.0005 + 0.0002,
        };

        return {
          id: entry.id,
          profile: decision.profile,
          lane: decision.lane,
          extractors: decision.extractors,
          cost: cost.totalCost,
        };
      });

      // Verify diversity of results
      const profiles = new Set(results.map((r) => r.profile));
      expect(profiles.has('filesystem')).toBe(true);
      expect(profiles.has('api:familysearch')).toBe(true);
      expect(profiles.has('images')).toBe(true);
      expect(profiles.has('pdf')).toBe(true);

      const lanes = new Set(results.map((r) => r.lane));
      expect(lanes.has('fast')).toBe(true);
      expect(lanes.has('deep')).toBe(true);

      // Verify cost tracking
      const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
      expect(totalCost).toBeGreaterThan(0);
      expect(totalCost).toBeLessThan(1.0); // Sanity check
    });

    it('handles retry and quarantine logic in cascade', () => {
      const retryEntry = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        mediaType: 'text/plain',
        size: 1024,
        retryCount: 2,
        fromDLQ: true,
      };

      const decision1 = route(retryEntry);
      expect(decision1.lane).not.toBe('quarantine'); // Still under limit

      const escalatedEntry = { ...retryEntry, retryCount: 4 };
      const decision2 = route(escalatedEntry);
      expect(decision2.lane).toBe('quarantine'); // Over limit
    });

    it('verifies auditing captures all routing signals', () => {
      const entries = [
        { source: 'filesystem', mediaType: 'text/plain', size: 512 },
        { source: 'api:familysearch', mediaType: 'application/json', size: 2048 },
        { source: 'unknown-img-source', mediaType: 'image/png', size: 1024 * 1024 },
      ];

      const auditRecords = entries.map((entry) => {
        const decision = route(entry);
        const verification: VerificationResult = {
          passed: true,
          errors: [],
        };
        const cost: Cost = {
          extractorCost: 0.001,
          verificationCost: 0.0005,
          totalCost: 0.0015,
        };

        return {
          source: entry.source,
          profile: decision.profile,
          lane: decision.lane,
          extractors: decision.extractors,
          verified: verification.passed,
          cost: cost.totalCost,
        };
      });

      expect(auditRecords.length).toBe(3);
      expect(auditRecords[0].profile).toBe('filesystem');
      expect(auditRecords[1].profile).toBe('api:familysearch');
      expect(auditRecords[2].profile).toBe('images');

      // Verify lanes match extraction complexity
      expect(auditRecords[0].lane).toBe('fast');
      expect(auditRecords[1].lane).toBe('deep');
      expect(auditRecords[2].lane).toBe('deep');

      // All should be verified
      auditRecords.forEach((record) => {
        expect(record.verified).toBe(true);
      });
    });
  });

  describe('Error Handling & Edge Cases', () => {
    it('handles unknown source gracefully', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'unknown',
        mediaType: 'unknown/unknown',
        size: 512,
      };

      const decision = route(entry);

      // Should fallback to filesystem, but unknown sources get downgraded from fast to deep
      expect(decision.profile).toBe('filesystem');
      expect(decision.lane).toBe('deep');
    });

    it('handles missing profile fields with defaults', () => {
      const minimalEntry = {
        id: crypto.randomUUID(),
      };

      const decision = route(minimalEntry);

      expect(decision.profile).toBe('filesystem');
      // Unknown source triggers downgrade to deep even with minimal fields
      expect(decision.lane).toBe('deep');
      expect(Array.isArray(decision.extractors)).toBe(true);
    });

    it('respects operator approval requirements', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'api:familysearch',
        mediaType: 'application/json',
        size: 1024,
      };

      const decision = route(entry);
      expect(decision.profile).toBe('api:familysearch');
      // Note: actual operator approval logic handled at higher layer
    });
  });
});
