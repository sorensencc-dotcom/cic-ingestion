/**
 * Wayland Security Policy Engine
 * Validates tool execution against configured policies
 * Supports rule-based allow/deny decisions with cascade depth limits
 */
export interface PolicyRule {
    id: string;
    name: string;
    pattern: string | RegExp;
    action: 'allow' | 'deny';
    priority: number;
    conditions?: {
        maxDepth?: number;
        maxTokens?: number;
        requiresApproval?: boolean;
        allowedRoles?: string[];
    };
}
export interface ExecutionContext {
    toolName: string;
    userId: string;
    cascadeDepth: number;
    estimatedTokens?: number;
    userRole?: string;
}
export interface PolicyDecision {
    allowed: boolean;
    reason: string;
    requiresApproval?: boolean;
    matchedRule?: string;
}
export declare class WaylandSecurityPolicy {
    private rules;
    private defaultAction;
    private cascadeDepthLimit;
    constructor(defaultAction?: 'allow' | 'deny', depthLimit?: number);
    private initializeDefaultRules;
    addRule(rule: PolicyRule): void;
    removeRule(ruleId: string): boolean;
    getRules(): PolicyRule[];
    evaluate(context: ExecutionContext): PolicyDecision;
    private ruleMatches;
    private checkConditions;
    setDefaultAction(action: 'allow' | 'deny'): void;
    setCascadeDepthLimit(limit: number): void;
    isToolAllowed(toolName: string): boolean;
    validateExecution(context: ExecutionContext): PolicyDecision;
}
export declare function createDefaultSecurityPolicy(): WaylandSecurityPolicy;
export declare function createRestrictiveSecurityPolicy(): WaylandSecurityPolicy;
//# sourceMappingURL=wayland-security-policy.d.ts.map