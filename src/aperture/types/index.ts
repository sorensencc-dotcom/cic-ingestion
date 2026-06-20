/**
 * Phase 27: Aperture — Core Types
 * Shared type definitions for Registry, Policy, Orchestrator, Sandbox, Adapters
 */

import { JSONSchema7 } from 'json-schema';

// ============================================================================
// Registry Types
// ============================================================================

export interface AdapterDefinition {
  /**
   * Unique identifier: {category}.{operation}
   * e.g., "shell.exec", "http.get", "file.read"
   */
  id: string;

  name: string;
  description: string;
  category: 'shell' | 'file' | 'http' | 'browser' | 'model';

  /**
   * Input/output schema validation
   */
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;

  /**
   * Resource & safety constraints
   */
  policy: {
    cost: number;
    maxExecutionMs: number;
    maxRetries: number;
    deterministic: boolean;
  };

  /**
   * Access control
   */
  accessControl: {
    allowedAgents?: string[];
    requiresApproval?: boolean;
  };

  /**
   * Implementation details
   */
  implementation: {
    module: string;
    version: string;
    environment?: Record<string, string>;
  };
}

// ============================================================================
// Policy Engine Types
// ============================================================================

export interface PolicyDefinition {
  name: string;
  agent: string;
  version: string;

  allow: string[];
  deny?: string[];

  limits: {
    max_calls: number;
    max_bytes: number;
    max_concurrent: number;
    max_depth: number;
    rate_limit_qps: number;
  };

  credentials?: {
    http_headers?: string[];
    allowed_domains?: string[];
  };

  safety?: {
    no_destructive?: boolean;
    require_approval_for?: string[];
    min_approval_confidence?: number;
  };

  audit?: {
    log_all?: boolean;
    sample_rate?: number;
    redact_fields?: string[];
  };
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  cost?: number;
}

export interface LimitCheckResult {
  ok: boolean;
  current: number;
  limit: number;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionContext {
  agent: string;
  traceId?: string;
  approvalGate?: ApprovalGate;
  sandbox?: SandboxHandle;
}

export interface ExecutionRequest {
  adapterId: string;
  input: any;
  context: ExecutionContext;
}

export interface ExecutionReceipt {
  id: string;
  timestamp: string; // ISO8601
  traceId: string;

  adapter: {
    id: string;
    version: string;
  };

  agent: string;
  policy: string;

  input: {
    params: any;
    size_bytes: number;
  };

  output: {
    result: any;
    size_bytes: number;
    schema_valid: boolean;
  };

  status: 'success' | 'failed' | 'timeout' | 'denied';
  latency_ms: number;
  retries: number;

  error?: {
    code: string;
    message: string;
    stack?: string;
  };

  policy_check: {
    authorized: boolean;
    reason?: string;
    approval_required: boolean;
    approval_status?: 'pending' | 'approved' | 'rejected';
  };

  sandbox: {
    id: string;
    isolation_level: 'ephemeral' | 'shared';
    cleanup_status: 'success' | 'failed';
  };
}

export interface ExecutionResult {
  receipt: ExecutionReceipt;
  output: any;
}

// ============================================================================
// Sandbox Types
// ============================================================================

export interface SandboxHandle {
  id: string;
  agent: string;
  createdAt: string;
  tmpdir: string;
  cleanup(): Promise<void>;
}

export interface SandboxSpec {
  agent: string;
  policy: PolicyDefinition;
  memoryQuotaMb: number;
  cpuQuotaPercent: number;
  ephemeralOnly: boolean;
}

// ============================================================================
// Adapter Types
// ============================================================================

export interface Adapter {
  metadata(): {
    id: string;
    name: string;
    version: string;
  };

  validate(input: any): {
    valid: boolean;
    errors?: string[];
  };

  execute(
    input: any,
    sandbox: SandboxHandle,
    options?: ExecutionOptions
  ): Promise<any>;

  schema(): {
    input: JSONSchema7;
    output: JSONSchema7;
  };
}

export interface ExecutionOptions {
  timeout?: number;
  retries?: number;
  deterministic?: boolean;
}

// ============================================================================
// Phase 24 Governance Integration
// ============================================================================

export interface ApprovalGate {
  request(
    agent: string,
    adapterId: string,
    input: any
  ): Promise<{
    approved: boolean;
    reason?: string;
  }>;
}

// ============================================================================
// Observability Types
// ============================================================================

export interface AdapterMetrics {
  adapter: string;
  status: 'success' | 'failed' | 'timeout';
  latency_ms: number;
  timestamp: string;
  bytes?: number;
  agent?: string;
}

export interface AdapterEvent {
  event_type: 'adapter_execution' | 'policy_denial' | 'sandbox_error';
  adapter?: string;
  agent?: string;
  status?: string;
  latency_ms?: number;
  timestamp: string;
  reason?: string;
}
