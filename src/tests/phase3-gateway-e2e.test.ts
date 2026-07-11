/**
 * Phase 3 Gateway E2E Test
 * Covers full pipeline: Phase2-Ingestion → Gateway → Cowork API → Orchestrator → Audit
 *
 * Test Plan:
 * 1. Take Phase 2 routed entries
 * 2. Format for gateway transmission (profile + lane + extractors)
 * 3. Call Cowork mock API (enrichment + orchestration)
 * 4. Record orchestrated results to audit manifest
 * 5. Verify E2E signal flow and cost+telemetry aggregation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';
import { route } from '../ingestion/ingestionRouter';
import type { RoutedIngestionDecision, VerificationResult, Cost } from '../ingestion/types';

// Mock Gateway Interface
interface GatewayRequest {
  entryId: string;
  profile: string;
  lane: string;
  extractors: string[];
  mediaType: string;
  size: number;
}

interface GatewayResponse {
  entryId: string;
  profile: string;
  lane: string;
  enrichedData?: Record<string, any>;
  orchestrationResult: {
    status: 'success' | 'partial' | 'failed';
    executedActions: string[];
    cost: number;
    executionTimeMs: number;
  };
  timestamp: number;
}

// Mock Cowork API
class MockCoworkAPI {
  async enrichAndOrchestrate(req: GatewayRequest): Promise<GatewayResponse> {
    // Simulate enrichment based on profile
    const enrichedData: Record<string, any> = {};
    const executedActions: string[] = [];
    let cost = 0.001;

    if (req.profile === 'filesystem') {
      enrichedData.fileType = 'text';
      enrichedData.encoding = 'utf8';
      executedActions.push('TextExtraction', 'SemanticAnalysis');
      cost += req.extractors.length * 0.0005;
    } else if (req.profile === 'api:familysearch') {
      enrichedData.dataType = 'genealogy';
      enrichedData.relationships = [];
      executedActions.push('RelationshipMapping', 'TopicExtraction', 'Verification');
      cost += req.extractors.length * 0.001;
    } else if (req.profile === 'images') {
      enrichedData.analysisType = 'visual';
      enrichedData.tags = [];
      executedActions.push('ImageAnalysis', 'ReverseImageSearch');
      cost += req.extractors.length * 0.0008;
    } else if (req.profile === 'pdf') {
      enrichedData.analysisType = 'document';
      enrichedData.extractedText = '';
      executedActions.push('PDFExtraction', 'TextExtraction', 'SemanticAnalysis');
      cost += req.extractors.length * 0.0007;
    } else {
      enrichedData.dataType = 'unknown';
      executedActions.push('BasicProcessing');
      cost += 0.0005;
    }

    // Simulate lane-specific orchestration
    if (req.lane === 'deep') {
      executedActions.push('DeepAnalysis');
      cost += 0.001;
    }

    return {
      entryId: req.entryId,
      profile: req.profile,
      lane: req.lane,
      enrichedData,
      orchestrationResult: {
        status: 'success',
        executedActions,
        cost,
        executionTimeMs: Math.random() * 500 + 100,
      },
      timestamp: Date.now(),
    };
  }
}

// Mock Gateway
class MockGateway {
  constructor(private coworkAPI: MockCoworkAPI) {}

  async processEntry(entry: any, decision: RoutedIngestionDecision): Promise<GatewayResponse> {
    const request: GatewayRequest = {
      entryId: entry.id,
      profile: decision.profile,
      lane: decision.lane,
      extractors: decision.extractors,
      mediaType: entry.mediaType || 'unknown/unknown',
      size: entry.size || 0,
    };

    return this.coworkAPI.enrichAndOrchestrate(request);
  }
}

describe('Phase 3: Gateway E2E — Ingestion → Cowork → Orchestrator → Audit', () => {
  let testManifestPath: string;
  let gateway: MockGateway;
  let coworkAPI: MockCoworkAPI;

  beforeEach(() => {
    testManifestPath = path.join(__dirname, '.test-phase3-manifest.jsonl');
    if (fs.existsSync(testManifestPath)) {
      fs.unlinkSync(testManifestPath);
    }

    coworkAPI = new MockCoworkAPI();
    gateway = new MockGateway(coworkAPI);
  });

  afterEach(() => {
    if (fs.existsSync(testManifestPath)) {
      fs.unlinkSync(testManifestPath);
    }
  });

  describe('Gateway Request Formatting', () => {
    it('formats filesystem entry for gateway', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        mediaType: 'text/plain',
        size: 1024,
      };

      const decision = route(entry);
      const request: GatewayRequest = {
        entryId: entry.id,
        profile: decision.profile,
        lane: decision.lane,
        extractors: decision.extractors,
        mediaType: entry.mediaType,
        size: entry.size,
      };

      expect(request.profile).toBe('filesystem');
      expect(request.lane).toBe('fast');
      expect(request.extractors).toContain('TextExtractor');
      expect(request.size).toBe(1024);
    });

    it('formats API entry with deep lane', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'api:familysearch',
        mediaType: 'application/json',
        size: 2048,
      };

      const decision = route(entry);
      const request: GatewayRequest = {
        entryId: entry.id,
        profile: decision.profile,
        lane: decision.lane,
        extractors: decision.extractors,
        mediaType: entry.mediaType,
        size: entry.size,
      };

      expect(request.profile).toBe('api:familysearch');
      expect(request.lane).toBe('deep');
      expect(request.extractors).toContain('RelationshipExtractor');
    });
  });

  describe('Cowork API Enrichment', () => {
    it('enriches filesystem entry', async () => {
      const request: GatewayRequest = {
        entryId: crypto.randomUUID(),
        profile: 'filesystem',
        lane: 'fast',
        extractors: ['TextExtractor', 'SemanticExtractor'],
        mediaType: 'text/plain',
        size: 1024,
      };

      const response = await coworkAPI.enrichAndOrchestrate(request);

      expect(response.orchestrationResult.status).toBe('success');
      expect(response.enrichedData?.fileType).toBe('text');
      expect(response.orchestrationResult.executedActions).toContain('TextExtraction');
      expect(response.orchestrationResult.cost).toBeGreaterThan(0);
    });

    it('enriches API genealogy entry with deep analysis', async () => {
      const request: GatewayRequest = {
        entryId: crypto.randomUUID(),
        profile: 'api:familysearch',
        lane: 'deep',
        extractors: ['TextExtractor', 'RelationshipExtractor', 'TopicExtractor'],
        mediaType: 'application/json',
        size: 2048,
      };

      const response = await coworkAPI.enrichAndOrchestrate(request);

      expect(response.orchestrationResult.status).toBe('success');
      expect(response.enrichedData?.dataType).toBe('genealogy');
      expect(response.orchestrationResult.executedActions).toContain('RelationshipMapping');
      expect(response.orchestrationResult.executedActions).toContain('DeepAnalysis');
      expect(response.orchestrationResult.cost).toBeGreaterThan(0.002);
    });

    it('enriches image entry with visual analysis', async () => {
      const request: GatewayRequest = {
        entryId: crypto.randomUUID(),
        profile: 'images',
        lane: 'deep',
        extractors: ['ImageAnalyzer', 'ReverseImageSearchExtractor'],
        mediaType: 'image/png',
        size: 1024 * 1024,
      };

      const response = await coworkAPI.enrichAndOrchestrate(request);

      expect(response.orchestrationResult.status).toBe('success');
      expect(response.enrichedData?.analysisType).toBe('visual');
      expect(response.orchestrationResult.executedActions).toContain('ImageAnalysis');
      expect(response.orchestrationResult.executedActions).toContain('DeepAnalysis');
    });

    it('enriches PDF entry with document analysis', async () => {
      const request: GatewayRequest = {
        entryId: crypto.randomUUID(),
        profile: 'pdf',
        lane: 'deep',
        extractors: ['PDFExtractor', 'TextExtractor', 'SemanticExtractor'],
        mediaType: 'application/pdf',
        size: 2 * 1024 * 1024,
      };

      const response = await coworkAPI.enrichAndOrchestrate(request);

      expect(response.orchestrationResult.status).toBe('success');
      expect(response.enrichedData?.analysisType).toBe('document');
      expect(response.orchestrationResult.executedActions).toContain('PDFExtraction');
    });
  });

  describe('Gateway Processing Pipeline', () => {
    it('routes filesystem entry through gateway', async () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        mediaType: 'text/plain',
        size: 1024,
      };

      const decision = route(entry);
      const response = await gateway.processEntry(entry, decision);

      expect(response.entryId).toBe(entry.id);
      expect(response.profile).toBe('filesystem');
      expect(response.orchestrationResult.status).toBe('success');
      expect(response.timestamp).toBeGreaterThan(0);
    });

    it('routes API entry through gateway', async () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'api:familysearch',
        mediaType: 'application/json',
        size: 2048,
      };

      const decision = route(entry);
      const response = await gateway.processEntry(entry, decision);

      expect(response.entryId).toBe(entry.id);
      expect(response.profile).toBe('api:familysearch');
      expect(response.orchestrationResult.status).toBe('success');
    });
  });

  describe('Full E2E Pipeline', () => {
    it('processes diverse batch through gateway', async () => {
      const entries = [
        {
          id: crypto.randomUUID(),
          source: 'filesystem',
          mediaType: 'text/plain',
          size: 512,
        },
        {
          id: crypto.randomUUID(),
          source: 'api:familysearch',
          mediaType: 'application/json',
          size: 1024,
        },
        {
          id: crypto.randomUUID(),
          source: 'unknown-img',
          mediaType: 'image/jpeg',
          size: 2 * 1024 * 1024,
        },
        {
          id: crypto.randomUUID(),
          source: 'unknown-pdf',
          mediaType: 'application/pdf',
          size: 5 * 1024 * 1024,
        },
      ];

      const results = [];
      for (const entry of entries) {
        const decision = route(entry);
        const response = await gateway.processEntry(entry, decision);
        results.push({
          entryId: response.entryId,
          profile: response.profile,
          lane: response.lane,
          status: response.orchestrationResult.status,
          cost: response.orchestrationResult.cost,
          executionTimeMs: response.orchestrationResult.executionTimeMs,
        });
      }

      expect(results.length).toBe(4);
      expect(results.every(r => r.status === 'success')).toBe(true);

      // Verify profile diversity
      const profiles = new Set(results.map(r => r.profile));
      expect(profiles.has('filesystem')).toBe(true);
      expect(profiles.has('api:familysearch')).toBe(true);
      expect(profiles.has('images')).toBe(true);
      expect(profiles.has('pdf')).toBe(true);

      // Verify lane assignment
      const lanes = new Set(results.map(r => r.lane));
      expect(lanes.has('fast')).toBe(true);
      expect(lanes.has('deep')).toBe(true);

      // Verify cost aggregation
      const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
      expect(totalCost).toBeGreaterThan(0.01);
    });

    it('records gateway results to audit manifest', async () => {
      const entries = [
        {
          id: crypto.randomUUID(),
          source: 'filesystem',
          mediaType: 'text/plain',
          size: 1024,
        },
        {
          id: crypto.randomUUID(),
          source: 'api:familysearch',
          mediaType: 'application/json',
          size: 2048,
        },
      ];

      const auditRecords = [];
      for (const entry of entries) {
        const decision = route(entry);
        const response = await gateway.processEntry(entry, decision);

        const auditRecord = {
          id: entry.id,
          source: entry.source,
          profile: decision.profile,
          lane: decision.lane,
          orchestrationStatus: response.orchestrationResult.status,
          executedActions: response.orchestrationResult.executedActions,
          cost: response.orchestrationResult.cost,
          executionTimeMs: response.orchestrationResult.executionTimeMs,
          gatewayTimestamp: response.timestamp,
        };

        auditRecords.push(auditRecord);

        // Write to manifest
        const line = JSON.stringify(auditRecord) + '\n';
        fs.appendFileSync(testManifestPath, line);
      }

      // Verify manifest was written
      expect(fs.existsSync(testManifestPath)).toBe(true);
      const content = fs.readFileSync(testManifestPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      expect(lines.length).toBe(2);

      // Verify records are valid JSON
      lines.forEach(line => {
        const record = JSON.parse(line);
        expect(record.id).toBeDefined();
        expect(record.orchestrationStatus).toBe('success');
        expect(record.cost).toBeGreaterThan(0);
      });
    });
  });

  describe('Cost & Telemetry Aggregation', () => {
    it('aggregates costs across gateway-processed entries', async () => {
      const entries = [
        {
          id: crypto.randomUUID(),
          source: 'filesystem',
          mediaType: 'text/plain',
          size: 1024,
        },
        {
          id: crypto.randomUUID(),
          source: 'unknown-img',
          mediaType: 'image/jpeg',
          size: 1024 * 1024,
        },
        {
          id: crypto.randomUUID(),
          source: 'api:familysearch',
          mediaType: 'application/json',
          size: 2048,
        },
      ];

      const costs = [];
      for (const entry of entries) {
        const decision = route(entry);
        const response = await gateway.processEntry(entry, decision);
        costs.push(response.orchestrationResult.cost);
      }

      const totalCost = costs.reduce((a, b) => a + b, 0);
      const avgCost = totalCost / costs.length;

      expect(totalCost).toBeGreaterThan(0.005);
      expect(avgCost).toBeGreaterThan(0.001);
      expect(costs.every(c => c > 0)).toBe(true);
    });

    it('tracks execution time across profiles', async () => {
      const entries = [
        {
          id: crypto.randomUUID(),
          source: 'filesystem',
          mediaType: 'text/plain',
          size: 512,
        },
        {
          id: crypto.randomUUID(),
          source: 'api:familysearch',
          mediaType: 'application/json',
          size: 1024,
        },
      ];

      const executionTimes = [];
      for (const entry of entries) {
        const decision = route(entry);
        const response = await gateway.processEntry(entry, decision);
        executionTimes.push(response.orchestrationResult.executionTimeMs);
      }

      executionTimes.forEach(time => {
        expect(time).toBeGreaterThan(100);
        expect(time).toBeLessThan(600);
      });
    });
  });

  describe('Gateway Error Handling', () => {
    it('handles unknown profile gracefully', async () => {
      const request: GatewayRequest = {
        entryId: crypto.randomUUID(),
        profile: 'unknown-profile',
        lane: 'fast',
        extractors: [],
        mediaType: 'unknown/unknown',
        size: 0,
      };

      const response = await coworkAPI.enrichAndOrchestrate(request);

      expect(response.orchestrationResult.status).toBe('success');
      expect(response.enrichedData?.dataType).toBe('unknown');
      expect(response.orchestrationResult.executedActions).toContain('BasicProcessing');
    });

    it('handles missing extractors', async () => {
      const request: GatewayRequest = {
        entryId: crypto.randomUUID(),
        profile: 'filesystem',
        lane: 'fast',
        extractors: [],
        mediaType: 'text/plain',
        size: 1024,
      };

      const response = await coworkAPI.enrichAndOrchestrate(request);

      expect(response.orchestrationResult.status).toBe('success');
      expect(response.orchestrationResult.executedActions.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 2→3 Integration', () => {
    it('converts Phase 2 routed entry to Phase 3 gateway format', () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'filesystem',
        mediaType: 'text/plain',
        size: 1024,
        retryCount: 0,
        fromDLQ: false,
      };

      // Phase 2: route
      const decision = route(entry);

      // Phase 3: format for gateway
      const gatewayRequest: GatewayRequest = {
        entryId: entry.id,
        profile: decision.profile,
        lane: decision.lane,
        extractors: decision.extractors,
        mediaType: entry.mediaType,
        size: entry.size,
      };

      expect(gatewayRequest.profile).toBeDefined();
      expect(gatewayRequest.lane).toBeDefined();
      expect(gatewayRequest.extractors.length).toBeGreaterThan(0);
    });

    it('preserves entry context across Phase 2→3 boundary', async () => {
      const entry = {
        id: crypto.randomUUID(),
        source: 'api:familysearch',
        mediaType: 'application/json',
        size: 2048,
        retryCount: 1,
        fromDLQ: false,
      };

      // Phase 2: route
      const decision = route(entry);

      // Phase 3: gateway
      const response = await gateway.processEntry(entry, decision);

      // Verify context preserved
      expect(response.entryId).toBe(entry.id);
      expect(response.profile).toBe(decision.profile);
      expect(response.lane).toBe(decision.lane);
    });
  });
});
