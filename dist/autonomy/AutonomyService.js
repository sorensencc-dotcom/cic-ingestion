/**
 * Autonomy Service — orchestrates signal detection and proposal generation
 * Sits between API routes and business logic (Phase 23.7.3)
 */
import { SignalDetectionEngine } from './SignalDetection';
import { RoadmapProposalEngine } from './RoadmapProposalEngine';
/**
 * In-memory store for signals and proposals (in production, use database)
 */
class AutonomyStore {
    constructor() {
        this.signals = new Map();
        this.proposals = new Map();
    }
    addSignal(signal) {
        this.signals.set(signal.id, signal);
    }
    getSignal(id) {
        return this.signals.get(id);
    }
    getAllSignals() {
        return Array.from(this.signals.values());
    }
    addProposal(proposal) {
        this.proposals.set(proposal.id, proposal);
    }
    getProposal(id) {
        return this.proposals.get(id);
    }
    getAllProposals() {
        return Array.from(this.proposals.values());
    }
    updateProposalStatus(id, status) {
        const proposal = this.proposals.get(id);
        if (proposal) {
            proposal.status = status;
        }
        return proposal;
    }
    clear() {
        this.signals.clear();
        this.proposals.clear();
    }
}
export class AutonomyService {
    constructor(config) {
        this.config = config;
        this.signalEngine = new SignalDetectionEngine();
        this.proposalEngine = new RoadmapProposalEngine();
        this.store = new AutonomyStore();
    }
    /**
     * Detect signals from event history
     * Fetches events/metrics from MemoryQueryAPI and runs detection
     */
    async detectSignals(startDate, endDate) {
        try {
            // Fetch events and metrics from MemoryQueryAPI
            const [events, driftMetrics, healthMetrics] = await Promise.all([
                this.fetchEvents(startDate, endDate),
                this.fetchDriftMetrics(),
                this.fetchHealthMetrics(),
            ]);
            // Build detection context
            const context = {
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
        }
        catch (err) {
            console.error('Signal detection error:', err);
            throw err;
        }
    }
    /**
     * Generate proposals from signals
     */
    async generateProposals(signals) {
        try {
            // Use provided signals or fetch all stored signals
            const signalsToUse = signals || this.store.getAllSignals();
            if (signalsToUse.length === 0) {
                return [];
            }
            // Generate proposals
            const proposals = await this.proposalEngine.generateProposals(signalsToUse, this.config.roadmapContext);
            // Store and return
            for (const proposal of proposals) {
                this.store.addProposal(proposal);
            }
            return proposals;
        }
        catch (err) {
            console.error('Proposal generation error:', err);
            throw err;
        }
    }
    /**
     * Query signals with filters
     */
    querySignals(query) {
        let results = this.store.getAllSignals();
        // Filter by type
        if (query.type && query.type.length > 0) {
            results = results.filter((s) => query.type.includes(s.type));
        }
        // Filter by severity
        if (query.severity && query.severity.length > 0) {
            results = results.filter((s) => query.severity.includes(s.severity));
        }
        // Filter by phase
        if (query.phase && query.phase.length > 0) {
            results = results.filter((s) => s.affectedPhases.some((p) => query.phase.includes(p)));
        }
        // Filter by confidence
        if (query.minConfidence !== undefined) {
            results = results.filter((s) => s.confidence >= query.minConfidence);
        }
        // Sort by timestamp (newest first)
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // Paginate
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        return results.slice(offset, offset + limit);
    }
    /**
     * Query proposals with filters
     */
    queryProposals(query) {
        let results = this.store.getAllProposals();
        // Filter by status
        if (query.status && query.status.length > 0) {
            results = results.filter((p) => query.status.includes(p.status));
        }
        // Filter by priority
        if (query.minPriority !== undefined) {
            const { scoreProposalPriority } = require('./models/RoadmapProposal');
            results = results.filter((p) => scoreProposalPriority(p) >= query.minPriority);
        }
        // Sort by timestamp (newest first)
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // Paginate
        const offset = query.offset || 0;
        const limit = query.limit || 100;
        return results.slice(offset, offset + limit);
    }
    /**
     * Get signal by ID
     */
    getSignal(id) {
        return this.store.getSignal(id);
    }
    /**
     * Get proposal by ID
     */
    getProposal(id) {
        return this.store.getProposal(id);
    }
    /**
     * Update proposal status (e.g., approve, reject, execute)
     */
    updateProposalStatus(id, status) {
        return this.store.updateProposalStatus(id, status);
    }
    /**
     * Run full autonomy cycle: detect signals → generate proposals
     */
    async runFullCycle(startDate, endDate) {
        const signals = await this.detectSignals(startDate, endDate);
        const proposals = await this.generateProposals(signals);
        return { signals, proposals };
    }
    /**
     * Helper: Fetch events from MemoryQueryAPI
     */
    async fetchEvents(startDate, endDate) {
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
    async fetchDriftMetrics() {
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
    async fetchHealthMetrics() {
        const url = `${this.config.memoryQueryApiUrl}/memory/summaries?window=hourly&metric=health`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch health metrics: ${response.statusText}`);
        }
        return response.json();
    }
}
//# sourceMappingURL=AutonomyService.js.map