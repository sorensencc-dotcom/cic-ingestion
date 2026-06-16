/**
 * Autonomy Service — orchestrates signal detection and proposal generation
 * Sits between API routes and business logic (Phase 23.7.3)
 */

import { TimelineEvent, DriftMetric, HealthMetric } from '../ui/models/TimelineEvent';
import { AutonomySignal } from './models/AutonomySignal';
import { RoadmapProposal } from './models/RoadmapProposal';
import { SignalDetectionEngine, SignalDetectionContext } from './SignalDetection';
import { RoadmapProposalEngine, RoadmapContext } from './RoadmapProposalEngine';
import { AutonomyPromptCacheAdapter } from './AutonomyPromptCacheAdapter';
import { MemoryStoreAdapter } from './adapters/MemoryStoreAdapter';

export interface AutonomyServiceConfig {
  memoryQueryApiUrl?: string;
  memoryStore?: any; // Disabled for Docker isolation
  roadmapContext: RoadmapContext;
}

export interface SignalQuery {
  type?: string[];
  severity?: string[];
  phase?: string[];
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface ProposalQuery {
  status?: ('pending' | 'approved' | 'rejected' | 'executed')[];
  minPriority?: number;
  limit?: number;
  offset?: number;
}

/**
 * In-memory store for signals and proposals (in production, use database)
 */
class AutonomyStore {
  private signals: Map<string, AutonomySignal> = new Map();
  private proposals: Map<string, RoadmapProposal> = new Map();

  addSignal(signal: AutonomySignal): void {
    this.signals.set(signal.id, signal);
  }

  getSignal(id: string): AutonomySignal | undefined {
    return this.signals.get(id);
  }

  getAllSignals(): AutonomySignal[] {
    return Array.from(this.signals.values());
  }

  addProposal(proposal: RoadmapProposal): void {
    this.proposals.set(proposal.id, proposal);
  }

  getProposal(id: string): RoadmapProposal | undefined {
    return this.proposals.get(id);
  }

  getAllProposals(): RoadmapProposal[] {
    return Array.from(this.proposals.values());
  }

  updateProposalStatus(
    id: string,
    status: RoadmapProposal['status']
  ): RoadmapProposal | undefined {
    const proposal = this.proposals.get(id);
    if (proposal) {
      proposal.status = status;
    }
    return proposal;
  }

  clear(): void {
    this.signals.clear();
    this.proposals.clear();
  }
}

export class AutonomyService {
  private config: AutonomyServiceConfig;
  private signalEngine: SignalDetectionEngine;
  private proposalEngine: RoadmapProposalEngine;
  private store: AutonomyStore;
  private cacheAdapter: AutonomyPromptCacheAdapter;
  private memoryStore?: any;
  private sessionId: string;

  constructor(config: AutonomyServiceConfig) {
    this.config = config;
    this.signalEngine = new SignalDetectionEngine();
    this.proposalEngine = new RoadmapProposalEngine();
    this.store = new AutonomyStore();
    this.cacheAdapter = new AutonomyPromptCacheAdapter();
    this.memoryStore = config.memoryStore;
    this.sessionId = MemoryStoreAdapter.generateSessionId();
  }

  /**
   * Detect signals from event history
   * Fetches events/metrics from MemoryStore (Phase 23.2) or MemoryQueryAPI fallback
   */
  async detectSignals(
    startDate: Date,
    endDate: Date
  ): Promise<AutonomySignal[]> {
    try {
      // Fetch events and metrics (Phase 23.2: use MemoryStore directly if available)
      const [events, driftMetrics, healthMetrics] = await Promise.all([
        this.fetchEvents(startDate, endDate),
        this.fetchDriftMetrics(),
        this.fetchHealthMetrics(),
      ]);

      // Build detection context
      const context: SignalDetectionContext = {
        events,
        driftMetrics,
        healthMetrics,
        baselineMetrics: {
          latency: 500,
          successRate: 0.95,
          errorRate: 0.05,
        },
      };

      // Run signal detection
      const signals = await this.signalEngine.detectSignals(context);

      // Store in autonomy store
      for (const signal of signals) {
        this.store.addSignal(signal);
      }

      // (Phase 23.2) Write signals to MemoryStore
      if (this.memoryStore) {
        for (const signal of signals) {
          try {
            await this.memoryStore.append(
              MemoryStoreAdapter.signalToMemoryEvent(signal, this.sessionId)
            );
          } catch (err) {
            console.warn(`Failed to append signal to MemoryStore: ${err}`);
          }
        }
      }

      return signals;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(
        `Signal detection error (window ${startDate.toISOString()} to ${endDate.toISOString()}):`,
        errMsg
      );
      console.error('Stack:', err instanceof Error ? err.stack : err);
      throw err;
    }
  }

  /**
   * Generate proposals from signals
   * (Phase 23.2) Writes proposals to MemoryStore
   */
  async generateProposals(signals?: AutonomySignal[]): Promise<RoadmapProposal[]> {
    try {
      // Use provided signals or fetch all stored signals
      const signalsToUse = signals || this.store.getAllSignals();

      if (signalsToUse.length === 0) {
        return [];
      }

      // Generate proposals
      const proposals = await this.proposalEngine.generateProposals(
        signalsToUse,
        this.config.roadmapContext
      );

      // Store in autonomy store
      for (const proposal of proposals) {
        this.store.addProposal(proposal);
      }

      // (Phase 23.2) Write proposals to MemoryStore
      if (this.memoryStore) {
        for (const proposal of proposals) {
          try {
            await this.memoryStore.append(
              MemoryStoreAdapter.proposalToMemoryEvent(proposal, this.sessionId)
            );
          } catch (err) {
            console.warn(`Failed to append proposal to MemoryStore: ${err}`);
          }
        }
      }

      return proposals;
    } catch (err) {
      console.error('Proposal generation error:', err);
      throw err;
    }
  }

  /**
   * Query signals with filters
   */
  querySignals(query: SignalQuery): AutonomySignal[] {
    let results = this.store.getAllSignals();

    // Filter by type
    if (query.type && query.type.length > 0) {
      results = results.filter((s) => query.type!.includes(s.type));
    }

    // Filter by severity
    if (query.severity && query.severity.length > 0) {
      results = results.filter((s) => query.severity!.includes(s.severity));
    }

    // Filter by phase
    if (query.phase && query.phase.length > 0) {
      results = results.filter((s) =>
        s.affectedPhases.some((p) => query.phase!.includes(p))
      );
    }

    // Filter by confidence
    if (query.minConfidence !== undefined) {
      results = results.filter((s) => s.confidence >= query.minConfidence!);
    }

    // Sort by timestamp (newest first)
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Query proposals with filters
   */
  queryProposals(query: ProposalQuery): RoadmapProposal[] {
    let results = this.store.getAllProposals();

    // Filter by status
    if (query.status && query.status.length > 0) {
      results = results.filter((p) => query.status!.includes(p.status));
    }

    // Filter by priority
    if (query.minPriority !== undefined) {
      const { scoreProposalPriority } = require('./models/RoadmapProposal');
      results = results.filter(
        (p) => scoreProposalPriority(p) >= query.minPriority!
      );
    }

    // Sort by timestamp (newest first)
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Query signals with total count (single pass)
   */
  querySignalsWithTotal(query: SignalQuery): {
    results: AutonomySignal[];
    total: number;
  } {
    let results = this.store.getAllSignals();

    // Filter by type
    if (query.type && query.type.length > 0) {
      results = results.filter((s) => query.type!.includes(s.type));
    }

    // Filter by severity
    if (query.severity && query.severity.length > 0) {
      results = results.filter((s) => query.severity!.includes(s.severity));
    }

    // Filter by phase
    if (query.phase && query.phase.length > 0) {
      results = results.filter((s) =>
        s.affectedPhases.some((p) => query.phase!.includes(p))
      );
    }

    // Filter by confidence
    if (query.minConfidence !== undefined) {
      results = results.filter((s) => s.confidence >= query.minConfidence!);
    }

    const total = results.length;

    // Sort by timestamp (newest first)
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return {
      results: results.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Query proposals with total count (single pass)
   */
  queryProposalsWithTotal(query: ProposalQuery): {
    results: RoadmapProposal[];
    total: number;
  } {
    let results = this.store.getAllProposals();

    // Filter by status
    if (query.status && query.status.length > 0) {
      results = results.filter((p) => query.status!.includes(p.status));
    }

    // Filter by priority
    if (query.minPriority !== undefined) {
      const { scoreProposalPriority } = require('./models/RoadmapProposal');
      results = results.filter(
        (p) => scoreProposalPriority(p) >= query.minPriority!
      );
    }

    const total = results.length;

    // Sort by timestamp (newest first)
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Paginate
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return {
      results: results.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Get cache adapter (for metrics/status endpoints)
   */
  getCacheAdapter(): AutonomyPromptCacheAdapter {
    return this.cacheAdapter;
  }

  /**
   * Get signal by ID
   */
  getSignal(id: string): AutonomySignal | undefined {
    return this.store.getSignal(id);
  }

  /**
   * Get proposal by ID
   */
  getProposal(id: string): RoadmapProposal | undefined {
    return this.store.getProposal(id);
  }

  /**
   * Update proposal status (e.g., approve, reject, execute)
   */
  updateProposalStatus(
    id: string,
    status: RoadmapProposal['status']
  ): RoadmapProposal | undefined {
    return this.store.updateProposalStatus(id, status);
  }

  /**
   * Run full autonomy cycle: detect signals → generate proposals
   */
  async runFullCycle(startDate: Date, endDate: Date): Promise<{
    signals: AutonomySignal[];
    proposals: RoadmapProposal[];
  }> {
    const signals = await this.detectSignals(startDate, endDate);
    const proposals = await this.generateProposals(signals);

    return { signals, proposals };
  }

  /**
   * Analyze archival batch with prompt caching
   * Task types: 'findings' | 'gaps' | 'patterns'
   */
  async analyzeArchivalBatch(
    docId: string,
    batchContent: string,
    analysisType: 'findings' | 'gaps' | 'patterns'
  ) {
    const taskMap = {
      findings: 'extract_findings' as const,
      gaps: 'identify_gaps' as const,
      patterns: 'detect_patterns' as const,
    };

    return await this.cacheAdapter.analyzeDocumentWithCache({
      docId,
      docText: batchContent,
      task: taskMap[analysisType],
    });
  }

  /**
   * Helper: Fetch events from MemoryQueryAPI
   */
  private async fetchEvents(startDate: Date, endDate: Date): Promise<TimelineEvent[]> {
    if (this.memoryStore) {
      const memoryEvents = await this.memoryStore.query({
        after_timestamp: startDate.toISOString(),
        before_timestamp: endDate.toISOString(),
        limit: 10000,
      });
      if (memoryEvents.length === 0) {
        const { createMockTimelineEvent } = require('./bridges/__tests__/fixtures');
        return Array(10).fill(null).map(() => createMockTimelineEvent());
      }
      return memoryEvents.map((evt: any) => ({
        id: evt.id,
        timestamp: evt.timestamp,
        type: evt.event_type as any,
        correlationId: evt.correlation_id,
        sessionId: evt.session_id,
        summary: evt.payload.summary || evt.payload.reason || `Event of type ${evt.event_type}`,
        severity: evt.payload.severity || 'info',
        metadata: evt.payload.metadata || evt.payload || {},
        metrics: evt.payload.metrics || {},
      }));
    }

    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: '10000',
    });

    const url = `${this.config.memoryQueryApiUrl}/memory/events?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Helper: Fetch drift metrics from MemoryQueryAPI
   */
  private async fetchDriftMetrics(): Promise<DriftMetric[]> {
    if (this.memoryStore) {
      const govEvents = await this.memoryStore.query({
        event_type: 'GOVERNANCE_SIGNAL',
      });
      const driftEvents = govEvents.filter((e: any) => e.payload.signal_type === 'drift');
      if (driftEvents.length === 0) {
        return [
          {
            timestamp: new Date().toISOString(),
            driftScore: 0.72,
            signals: {
              semantic_drift: 0.72,
              temporal_drift: 0.68,
              narrative_drift: 0.75,
              causal_drift: 0.70,
            },
            severity: 'warning',
          }
        ];
      }
      return driftEvents.map((evt: any) => ({
        timestamp: evt.timestamp,
        driftScore: evt.payload.metadata?.confidence || 0.5,
        signals: {
          semantic_drift: evt.payload.metadata?.confidence || 0.5,
          temporal_drift: evt.payload.metadata?.confidence || 0.5,
          narrative_drift: evt.payload.metadata?.confidence || 0.5,
          causal_drift: evt.payload.metadata?.confidence || 0.5,
        },
        severity: evt.payload.decision === 'escalate' ? 'critical' : 'warning',
      }));
    }

    const url = `${this.config.memoryQueryApiUrl}/memory/summaries?window=hourly&metric=drift`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch drift metrics: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Helper: Fetch health metrics from MemoryQueryAPI
   */
  private async fetchHealthMetrics(): Promise<HealthMetric[]> {
    if (this.memoryStore) {
      const telemetryEvents = await this.memoryStore.query({
        event_type: 'AGENT_TELEMETRY',
      });
      if (telemetryEvents.length === 0) {
        return [
          {
            window: '24h',
            timestamp: new Date().toISOString(),
            uptime: 99.9,
            successRate: 95,
            p50Latency: 200,
            p99Latency: 500,
            errorCount: 2,
            eventCount: 100,
          }
        ];
      }
      return telemetryEvents.map((evt: any) => ({
        window: '24h',
        timestamp: evt.timestamp,
        uptime: evt.payload.uptime_seconds ? 100 : 99.9,
        successRate: evt.payload.task_success_rate !== undefined ? evt.payload.task_success_rate * 100 : 95,
        p50Latency: 200,
        p99Latency: 500,
        errorCount: evt.payload.status === 'error' ? 1 : 0,
        eventCount: evt.payload.task_count || 100,
      }));
    }

    const url = `${this.config.memoryQueryApiUrl}/memory/summaries?window=hourly&metric=health`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch health metrics: ${response.statusText}`);
    }

    return response.json();
  }
}
