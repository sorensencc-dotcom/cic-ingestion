/**
 * Phase 27: Aperture — Policy Engine
 * Declarative authorization & constraint enforcement
 */
import { PolicyDefinition, AuthorizationResult, LimitCheckResult } from '../types';
export declare class PolicyEngine {
    private policies;
    private agentLimitCounters;
    private agentTimestamps;
    /**
     * Load policy from definition
     */
    load(definition: PolicyDefinition): void;
    /**
     * Authorize a specific operation
     */
    authorize(agent: string, adapterId: string): AuthorizationResult;
    /**
     * Check if operation requires approval
     */
    preApproval(agent: string, adapterId: string): boolean;
    /**
     * Check execution limits
     */
    checkLimits(agent: string, stat: 'calls' | 'bytes' | 'depth' | 'qps'): LimitCheckResult;
    /**
     * Increment limit counter
     */
    incrementLimit(agent: string, stat: 'calls' | 'bytes' | 'depth' | 'qps', amount?: number): void;
    /**
     * Reset limits for agent (e.g., on invocation start)
     */
    resetLimits(agent: string): void;
    /**
     * Get approval confidence threshold
     */
    getApprovalThreshold(agent: string): number;
    /**
     * Get redact fields for audit logging
     */
    getRedactFields(agent: string): string[];
    /**
     * Check if all operations should be logged
     */
    shouldLogAll(agent: string): boolean;
    /**
     * Check if destructive operations are allowed
     */
    allowDestructive(agent: string): boolean;
    /**
     * Get allowed domains for HTTP operations
     */
    getAllowedDomains(agent: string): string[] | null;
    /**
     * Get allowed HTTP headers
     */
    getAllowedHeaders(agent: string): string[];
    /**
     * List all policies
     */
    listAll(): PolicyDefinition[];
    /**
     * Get policy by agent + name
     */
    getPolicy(agent: string, name: string): PolicyDefinition | null;
    /**
     * Get current policy for agent
     */
    getPolicyForAgent(agent: string): PolicyDefinition | null;
    /**
     * Check if adapter requires specific domain
     */
    checkDomain(agent: string, domain: string): boolean;
    /**
     * Get limits for agent
     */
    getLimits(agent: string): {
        max_calls: number;
        max_bytes: number;
        max_concurrent: number;
        max_depth: number;
        rate_limit_qps: number;
    } | null;
}
/**
 * Factory: Create policy engine with default policies
 */
export declare function createDefaultPolicyEngine(): PolicyEngine;
//# sourceMappingURL=PolicyEngine.d.ts.map