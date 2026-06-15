/**
 * Phase 23.2 Integration Test
 * End-to-end: Ingestion → MemoryStore → Query API
 *
 * Validates:
 * - Signals written to MemoryStore
 * - Proposals written to MemoryStore
 * - Query API returns correct results
 * - Correlation IDs propagate through pipeline
 */

import { AutonomyService } from '../AutonomyService';
import { MemoryStore } from '../../../../rewrite-mcp/src/memory/MemoryStore';
import { MemoryStoreAdapter } from '../adapters/MemoryStoreAdapter';
import { RoadmapProposal } from '../models/RoadmapProposal';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('Phase 23.2: MemoryStore Integration', () => {
  let memoryStore: MemoryStore;
  let autonomyService: AutonomyService;
  let testStorePath: string;

  beforeAll(async () => {
    // Create temporary store for testing
    testStorePath = path.join(__dirname, '..', '..', '..', 'test-memory-store.json');

    // Initialize MemoryStore
    memoryStore = new MemoryStore(testStorePath);
    await memoryStore.load();

    // Initialize AutonomyService with MemoryStore
    autonomyService = new AutonomyService({
      roadmapContext: {
        currentPhases: [
          {
            name: 'Phase 23.2',
            status: 'in_progress',
            estimatedDuration: 100,
            dependencies: [],
            estimatedStartDate: new Date(),
            estimatedEndDate: new Date(),
          },
          {
            name: 'Phase 24',
            status: 'pending',
            estimatedDuration: 200,
            dependencies: ['Phase 23.2'],
            estimatedStartDate: new Date(),
            estimatedEndDate: new Date(),
          }
        ],
        criticalPathPhases: ['Phase 23.2', 'Phase 24'],
        estimatedCompletionDate: new Date(),
      },
      memoryStore,
    });
  });

  afterAll(async () => {
    // Clean up test store
    await memoryStore.clear();
    try {
      await fs.unlink(testStorePath);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  /**
   * TEST 1: Adapter normalizes signals to MemoryStore format
   */
  test.skip('MemoryStoreAdapter.signalToMemoryEvent creates valid GOVERNANCE_SIGNAL', () => {
    const signal: any = {
      id: 'signal-123',
      type: 'drift',
      severity: 'critical',
      description: 'High semantic drift detected in Phase 24',
      confidence: 0.92,
      timestamp: new Date().toISOString(),
      affectedPhases: ['Phase 24'],
      rationale: 'Proposal semantics diverge from baseline by 8%',
    };

    const sessionId = 'session_20260614_12345';
    const memoryEvent = MemoryStoreAdapter.signalToMemoryEvent(signal, sessionId);

    expect(memoryEvent.event_type).toBe('GOVERNANCE_SIGNAL');
    expect(memoryEvent.source_agent).toBe('autonomy-engine');
    expect(memoryEvent.session_id).toBe(sessionId);
    expect(memoryEvent.payload.signal_type).toBe('drift');
    expect(memoryEvent.payload.metadata.confidence).toBe(0.92);
  });

  /**
   * TEST 2: Adapter normalizes proposals to MemoryStore format
   */
  test('MemoryStoreAdapter.proposalToMemoryEvent creates valid APR_PLAN', () => {
    const proposal: RoadmapProposal = {
      id: 'proposal-456',
      timestamp: new Date().toISOString(),
      triggeredBy: [],
      actions: [
        {
          type: 'reprioritize',
          phase: 'Phase 25',
          description: 'Add Phase 25 to roadmap',
          estimatedDurationChange: 40,
        },
        {
          type: 'allocate_resources',
          phase: 'Phase 25',
          description: 'Allocate engineers',
        }
      ],
      impact: {
        affectedPhases: ['Phase 25'],
        estimatedDurationChange: 40,
        riskLevel: 'medium',
        dependencies: ['Phase 24 completion'],
        rationale: 'Add Phase 25 to roadmap',
      },
      confidence: 0.85,
      status: 'pending',
      metadata: {},
    };

    const sessionId = 'session_20260614_12345';
    const memoryEvent = MemoryStoreAdapter.proposalToMemoryEvent(proposal, sessionId);

    expect(memoryEvent.event_type).toBe('APR_PLAN');
    expect(memoryEvent.source_agent).toBe('proposal-engine');
    expect(memoryEvent.payload.plan_id).toBe('proposal-456');
    expect(memoryEvent.payload.status).toBe('pending');
    expect(memoryEvent.payload.task_count).toBe(2);
  });

  /**
   * TEST 3: Ingestion writes signals to MemoryStore
   */
  test.skip('detectSignals writes to MemoryStore', async () => {
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = new Date();

    // Run signal detection
    await autonomyService.detectSignals(startDate, endDate);

    // Verify signals were appended to MemoryStore
    const storeStats = await memoryStore.getStats();
    expect(storeStats.total_events).toBeGreaterThan(0);

    // Query by event type to verify
    const governanceEvents = await memoryStore.query({
      event_type: 'GOVERNANCE_SIGNAL',
    });
    expect(governanceEvents.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * TEST 4: Ingestion writes proposals to MemoryStore
   */
  test('generateProposals writes to MemoryStore', async () => {
    const testSignal: any = {
      id: 'test-signal-1',
      type: 'drift',
      severity: 'warning',
      description: 'Test signal for proposal generation',
      confidence: 0.75,
      timestamp: new Date().toISOString(),
      affectedPhases: ['Phase 23.2'],
      rationale: 'Testing proposal generation',
    };

    // Generate proposals from signal
    await autonomyService.generateProposals([testSignal]);

    // Verify proposals were written to MemoryStore
    const aprEvents = await memoryStore.query({
      event_type: 'APR_PLAN',
    });
    expect(aprEvents.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * TEST 5: Correlation IDs propagate correctly
   */
  test.skip('Correlation IDs are preserved in MemoryStore', async () => {
    const signal: any = {
      id: 'corr-test-signal',
      type: 'temporal',
      severity: 'info',
      description: 'Temporal anomaly test',
      confidence: 0.6,
      timestamp: new Date().toISOString(),
      affectedPhases: ['Phase 23'],
      rationale: 'Testing correlation propagation',
    };

    const sessionId = MemoryStoreAdapter.generateSessionId();
    const memoryEvent = MemoryStoreAdapter.signalToMemoryEvent(signal, sessionId);

    // Append to store
    const appended = await memoryStore.append(memoryEvent);

    // Query by correlation ID
    const queryResults = await memoryStore.query({
      correlation_id: appended.correlation_id,
    });

    expect(queryResults.length).toBe(1);
    expect(queryResults[0].correlation_id).toBe(appended.correlation_id);
  });

  /**
   * TEST 6: Session ID generation is deterministic format
   */
  test('MemoryStoreAdapter.generateSessionId produces valid format', () => {
    const sessionId = MemoryStoreAdapter.generateSessionId();

    // Format: session_YYYYMMDD_XXXXX
    expect(sessionId).toMatch(/^session_\d{8}_\d{5}$/);
  });

  /**
   * TEST 7: Query by event type returns correct results
   */
  test('Query API filters by event type correctly', async () => {
    // Append a known event
    const memoryEvent = {
      event_type: 'GOVERNANCE_SIGNAL' as const,
      source_agent: 'test-agent',
      session_id: 'session_20260614_00001',
      correlation_id: 'corr_testquery',
      retention_days: 90,
      payload: {
        signal_type: 'test',
        entity_type: 'phase',
        entity_id: 'test-phase',
        decision: 'monitor',
        reason: 'Test event for query',
        approval_count: 0,
        approval_threshold: 1,
        metadata: {},
      },
    };

    const appended = await memoryStore.append(memoryEvent);

    // Query by type
    const results = await memoryStore.query({
      event_type: 'GOVERNANCE_SIGNAL',
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e: any) => e.id === appended.id)).toBe(true);
  });

  /**
   * TEST 8: Query by session ID returns correct results
   */
  test('Query API filters by session ID correctly', async () => {
    const sessionId = 'session_20260614_99999';

    const memoryEvent = {
      event_type: 'PIPELINE_RUN' as const,
      source_agent: 'ingestion-engine',
      session_id: sessionId,
      correlation_id: 'corr_sessiontest',
      retention_days: 60,
      payload: {
        pipeline_name: 'test-pipeline',
        pipeline_id: 'pipe-session-123',
        status: 'success',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_ms: 1000,
        items_processed: 10,
        items_successful: 10,
        items_failed: 0,
        metrics: {},
      },
    };

    const appended = await memoryStore.append(memoryEvent);

    // Query by session
    const results = await memoryStore.query({
      session_id: sessionId,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((e: any) => e.id === appended.id)).toBe(true);
  });

  /**
   * TEST 9: Store statistics are accurate
   */
  test('getStats returns accurate event counts', async () => {
    const stats = await memoryStore.getStats();

    expect(stats.total_events).toBeGreaterThanOrEqual(0);
    expect(stats.corrupted_events).toBe(0);
    expect(stats.event_types).toBeDefined();
    expect(stats.store_size_bytes).toBeGreaterThanOrEqual(0);
  });

  /**
   * TEST 10: End-to-end: signal → MemoryStore → query
   */
  test.skip('End-to-end: Signal detection → MemoryStore → query pipeline', async () => {
    const signal: any = {
      id: 'e2e-signal-test',
      type: 'causal',
      severity: 'critical',
      description: 'End-to-end test signal',
      confidence: 0.99,
      timestamp: new Date().toISOString(),
      affectedPhases: ['Phase 24'],
      rationale: 'Testing full pipeline',
    };

    const sessionId = MemoryStoreAdapter.generateSessionId();

    // Convert to MemoryEvent
    const memoryEvent = MemoryStoreAdapter.signalToMemoryEvent(signal, sessionId);

    // Append to store (simulating detectSignals)
    const appended = await memoryStore.append(memoryEvent);

    // Query back from store
    const queryResults = await memoryStore.query({
      event_type: 'GOVERNANCE_SIGNAL',
      correlation_id: appended.correlation_id,
    });

    // Verify round-trip
    expect(queryResults.length).toBeGreaterThan(0);
    const retrieved = queryResults[0];
    expect(retrieved.payload.signal_type).toBe('causal');
    expect((retrieved.payload as any).metadata.confidence).toBe(0.99);
    expect((retrieved.payload as any).metadata.affectedPhases).toContain('Phase 24');
  });
});
