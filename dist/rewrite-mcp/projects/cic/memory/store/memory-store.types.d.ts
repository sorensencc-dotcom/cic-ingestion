export type EventType = "ARPS_DELTA" | "PIPELINE_RUN" | "AGENT_TELEMETRY" | "GOVERNANCE_SIGNAL" | "APR_PLAN" | "CRO_RUN";
export interface MemoryEvent {
    id: string;
    timestamp: string;
    event_type: EventType;
    source_agent: string;
    session_id: string;
    correlation_id: string;
    payload: EventPayload;
    retention_days: number;
    checksum?: string;
    version: number;
}
export type EventPayload = ARPSDeltaPayload | PipelineRunPayload | AgentTelemetryPayload | GovernanceSignalPayload | APRPlanPayload | CRORunPayload;
export interface ARPSDeltaPayload {
    change_type: "phase_completion" | "phase_creation" | "prompt_rewrite" | "instruction_update" | "priority_adjustment";
    phase_id?: string;
    old_value: string;
    new_value: string;
    git_commit: string;
    confidence: number;
    affected_subsystems: string[];
}
export interface PipelineRunPayload {
    pipeline_name: string;
    pipeline_id: string;
    status: "success" | "partial" | "failed";
    start_time: string;
    end_time: string;
    duration_ms: number;
    items_processed: number;
    items_successful: number;
    items_failed: number;
    error_summary?: string;
    metrics: {
        throughput_items_per_second: number;
        error_rate_percent: number;
        resource_usage_mb: number;
    };
    failed_items?: Array<{
        item_id: string;
        error: string;
        severity: "low" | "medium" | "high";
    }>;
}
export interface AgentTelemetryPayload {
    agent_name: string;
    agent_class: "ingestion" | "processing" | "reasoning" | "planning" | "execution";
    status: "healthy" | "degraded" | "failed";
    uptime_seconds: number;
    task_count: number;
    task_success_rate: number;
    last_error?: string;
    last_error_time?: string;
    performance: {
        avg_task_duration_ms: number;
        p95_task_duration_ms: number;
        cpu_usage_percent: number;
        memory_usage_mb: number;
        error_rate_percent: number;
    };
    degradation_reason?: string;
}
export interface GovernanceSignalPayload {
    signal_type: "approval" | "rejection" | "escalation" | "zone_violation" | "threshold_crossed" | "constraint_violation";
    entity_type: "skill" | "extraction" | "phase_write" | "cli_command";
    entity_id: string;
    decision: "approved" | "rejected" | "escalated";
    reason: string;
    operator?: string;
    approval_count: number;
    approval_threshold: number;
    metadata: Record<string, any>;
}
export interface APRPlanPayload {
    plan_id: string;
    goal: string;
    plan_type: "feature_development" | "bug_fix" | "optimization" | "governance";
    status: "generated" | "in_progress" | "completed" | "failed";
    task_count: number;
    task_graph: Array<{
        id: string;
        name: string;
        depends_on: string[];
        estimated_effort_hours: number;
    }>;
    critical_path_hours: number;
    risk_level: "low" | "medium" | "high";
    risk_factors: string[];
    agent_consensus_score: number;
    agents_involved: string[];
}
export interface CRORunPayload {
    run_id: string;
    plan_id: string;
    status: "queued" | "running" | "completed" | "failed" | "rolled_back";
    start_time: string;
    end_time: string;
    duration_ms: number;
    step_count: number;
    step_results: Array<{
        step_id: string;
        task_id: string;
        agent_name: string;
        status: "success" | "failed";
        start_time: string;
        end_time: string;
        duration_ms: number;
        output_size_bytes: number;
        error?: string;
    }>;
    failure_info?: Record<string, any>;
    recovery_action?: string;
}
export type CreateMemoryEventInput = Omit<MemoryEvent, "id" | "checksum" | "version">;
//# sourceMappingURL=memory-store.types.d.ts.map