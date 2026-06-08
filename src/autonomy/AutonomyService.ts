/**
 * Autonomy Service — orchestrates signal detection and proposal generation
 * Sits between API routes and business logic (Phase 23.7.3)
 */

import { TimelineEvent, DriftMetric, HealthMetric } from '../ui/models/TimelineEvent';
import { AutonomySignal, isSignalValid } from './models/AutonomySignal';
import { RoadmapProposal } from './models/RoadmapProposal';
import { SignalDetectionEngine, SignalDetectionContext } from './SignalDetection';
import { RoadmapProposalEngine, RoadmapContext, PhaseInfo } from './RoadmapProposalEngine';

export interface AutonomyServiceConfig {
  memoryQueryApiUrl: string;
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

  constructor(config: AutonomyServiceConfig) {
    this.config = config;
    this.signalEngine = new SignalDetectionEngine();
    this.proposalEngine = new RoadmapProposalEngine();
    this.store = new AutonomyStore();
  }

  /**
   * Detect signals from event history
   * Fetches events/metrics from MemoryQueryAPI and runs detection
   */
  async detectSignals(
    startDate: Date,
    endDate: Date
  ): Promise<AutonomySignal[]> {
    try {
      // Fetch events and metrics from MemoryQueryAPI
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
          latency: 500, // TODO: fetch from config or baseline store
          successRate: 0.95,
          errorRate: 0.05,
        },
      };

      // Run signal detection
      const signals = await this.signalEngine.detectSignals(context);

      // Store and return
      for (const signal of signals) {
        this.store.addSignal(signal);
      }

      return signals;
    } catch (err) {
      console.error('Signal detection error:', err);
      throw err;
    }
  }

  /**
   * Generate proposals from signals
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

      // Store and return
      for (const proposal of proposals) {
        this.store.addProposal(proposal);
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
   * Helper: Fetch events from MemoryQueryAPI
   */
  private async fetchEvents(startDate: Date, endDate: Date): Promise<TimelineEvent[]> {
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
    const url = `${this.config.memoryQueryApiUrl}/memory/summaries?window=hourly&metric=health`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch health metrics: ${response.statusText}`);
    }

    return response.json();
  }
}
