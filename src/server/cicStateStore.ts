// semver: 0.1.0
// date: 2026-06-29
import fs from "fs";
import path from "path";

export type BackendId =
  | "ollama"
  | "localai"
  | "gpt4all"
  | "llamafile"
  | "koboldcpp"
  | "anythingllm"
  | "mock";

export interface SLASettings {
  maxLatencyMs: number;
  maxTokens: number;
  maxBacklog: number;
  maxOscillations: number;
}

export interface SLAMetrics {
  avgLatencyMs: number;
  totalTokens: number;
  backlogCount: number;
  routingChanges: number;
  lastEvaluated: number;
}

export interface ActivePlaybooks {
  driftSpike: boolean;
  routingStability: boolean;
  backendRecovery: boolean;
  ingestionRecovery: boolean;
  governanceLockdown: boolean;
  dashboardRecovery: boolean;
}

export interface SLAViolation {
  category: string;
  description: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  ts: number;
}

export interface CICPersistedState {
  drift: Record<BackendId, number>;
  slaSettings: SLASettings;
  slaMetrics: SLAMetrics;
  activePlaybooks: ActivePlaybooks;
  violations: SLAViolation[];
  routingFrozen: boolean;
  frozenBackend?: BackendId;
  promotionsFrozen: boolean;
  rollbacksFrozen: boolean;
  governanceLockdown: boolean;
}

export class CICStateStore {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath =
      filePath ||
      process.env.CIC_STATE_FILE ||
      path.resolve(process.cwd(), "governance", "cicState.json");
  }

  load(): CICPersistedState {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf8");
        return JSON.parse(data);
      }
    } catch (err: any) {
      console.error("[cicStateStore] failed to load state, using defaults:", err.message);
    }
    return this.getDefaultState();
  }

  save(state: CICPersistedState): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tempPath = this.filePath + ".tmp";
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), "utf8");
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
      fs.renameSync(tempPath, this.filePath);
    } catch (err: any) {
      console.error("[cicStateStore] failed to save state:", err.message);
    }
  }

  addViolation(
    category: string,
    description: string,
    severity: "SEV-1" | "SEV-2" | "SEV-3"
  ): CICPersistedState {
    const state = this.load();
    const idx = state.violations.findIndex((v) => v.category === category);
    const violation: SLAViolation = { category, description, severity, ts: Date.now() };

    if (idx !== -1) {
      state.violations[idx] = violation;
    } else {
      state.violations.push(violation);
    }

    // Auto-trigger playbooks/runbooks based on violation severity
    if (severity === "SEV-1") {
      if (category === "governance_chain_break") {
        state.governanceLockdown = true;
        state.promotionsFrozen = true;
        state.rollbacksFrozen = true;
        state.activePlaybooks.governanceLockdown = true;
      }
    } else if (severity === "SEV-2") {
      if (category === "routing_oscillation") {
        state.routingFrozen = true;
        state.activePlaybooks.routingStability = true;
      } else if (category === "ingestion_backlog") {
        state.activePlaybooks.ingestionRecovery = true;
      }
    } else if (severity === "SEV-3") {
      if (
        category === "latency_breach" ||
        category === "drift_spike" ||
        category === "token_breach"
      ) {
        state.activePlaybooks.driftSpike = true;
      }
    }

    this.save(state);
    return state;
  }

  clearViolation(category: string): CICPersistedState {
    const state = this.load();
    state.violations = state.violations.filter((v) => v.category !== category);

    // De-escalate corresponding playbooks
    if (category === "governance_chain_break") {
      state.governanceLockdown = false;
      state.promotionsFrozen = false;
      state.rollbacksFrozen = false;
      state.activePlaybooks.governanceLockdown = false;
    } else if (category === "routing_oscillation") {
      state.routingFrozen = false;
      state.activePlaybooks.routingStability = false;
      delete state.frozenBackend;
    } else if (category === "ingestion_backlog") {
      state.activePlaybooks.ingestionRecovery = false;
    } else if (
      category === "latency_breach" ||
      category === "drift_spike" ||
      category === "token_breach"
    ) {
      state.activePlaybooks.driftSpike = false;
    }

    this.save(state);
    return state;
  }

  triggerPlaybook(name: keyof ActivePlaybooks, active: boolean): CICPersistedState {
    const state = this.load();
    state.activePlaybooks[name] = active;

    if (name === "governanceLockdown") {
      state.governanceLockdown = active;
      state.promotionsFrozen = active;
      state.rollbacksFrozen = active;
    } else if ((name as string) === "routingStability") {
      state.routingFrozen = active;
    }

    this.save(state);
    return state;
  }

  freezeRouting(frozen: boolean, backend?: BackendId): CICPersistedState {
    const state = this.load();
    state.routingFrozen = frozen;

    if (frozen && backend) {
      state.frozenBackend = backend;
    } else if (!frozen) {
      delete state.frozenBackend;
    }

    this.save(state);
    return state;
  }

  setGovernanceLockdown(active: boolean): CICPersistedState {
    const state = this.load();
    state.governanceLockdown = active;
    state.promotionsFrozen = active;
    state.rollbacksFrozen = active;
    state.activePlaybooks.governanceLockdown = active;
    this.save(state);
    return state;
  }

  getDefaultState(): CICPersistedState {
    return {
      drift: {
        ollama: 0,
        localai: 0,
        gpt4all: 0,
        llamafile: 0,
        koboldcpp: 0,
        anythingllm: 0,
        mock: 0,
      },
      slaSettings: {
        maxLatencyMs: 1500,
        maxTokens: 3000,
        maxBacklog: 200,
        maxOscillations: 2,
      },
      slaMetrics: {
        avgLatencyMs: 0,
        totalTokens: 0,
        backlogCount: 0,
        routingChanges: 0,
        lastEvaluated: Date.now(),
      },
      activePlaybooks: {
        driftSpike: false,
        routingStability: false,
        backendRecovery: false,
        ingestionRecovery: false,
        governanceLockdown: false,
        dashboardRecovery: false,
      },
      violations: [],
      routingFrozen: false,
      promotionsFrozen: false,
      rollbacksFrozen: false,
      governanceLockdown: false,
    };
  }
}
