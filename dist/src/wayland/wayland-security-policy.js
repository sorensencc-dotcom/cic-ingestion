/**
 * Wayland Security Policy Engine
 * Validates tool execution against configured policies
 * Supports rule-based allow/deny decisions with cascade depth limits
 */
export class WaylandSecurityPolicy {
    constructor(defaultAction = 'allow', depthLimit = 10) {
        this.rules = new Map();
        this.defaultAction = 'allow';
        this.cascadeDepthLimit = 10;
        this.defaultAction = defaultAction;
        this.cascadeDepthLimit = depthLimit;
        this.initializeDefaultRules();
    }
    initializeDefaultRules() {
        // Default allow for read-only tools
        this.addRule({
            id: 'rule-read-tools',
            name: 'Allow read operations',
            pattern: /^(read|get|list|describe|query)/i,
            action: 'allow',
            priority: 10,
        });
        // Restrict shell execution
        this.addRule({
            id: 'rule-shell-restrict',
            name: 'Restrict shell execution',
            pattern: /^(bash|sh|powershell|exec)/i,
            action: 'deny',
            priority: 50,
            conditions: {
                requiresApproval: true,
            },
        });
        // Restrict file writes at depth > 5
        this.addRule({
            id: 'rule-write-depth',
            name: 'Limit write depth',
            pattern: /^(write|delete|remove|modify)/i,
            action: 'deny',
            priority: 30,
            conditions: {
                maxDepth: 5,
            },
        });
    }
    addRule(rule) {
        this.rules.set(rule.id, rule);
    }
    removeRule(ruleId) {
        return this.rules.delete(ruleId);
    }
    getRules() {
        return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
    }
    evaluate(context) {
        const rules = this.getRules();
        // Check cascade depth limit
        if (context.cascadeDepth > this.cascadeDepthLimit) {
            return {
                allowed: false,
                reason: `Cascade depth ${context.cascadeDepth} exceeds limit ${this.cascadeDepthLimit}`,
            };
        }
        // Evaluate rules in priority order
        for (const rule of rules) {
            if (this.ruleMatches(rule, context)) {
                const conditionsMet = this.checkConditions(rule, context);
                if (!conditionsMet.met) {
                    return {
                        allowed: false,
                        reason: conditionsMet.reason,
                        matchedRule: rule.id,
                    };
                }
                return {
                    allowed: rule.action === 'allow',
                    reason: rule.name,
                    requiresApproval: rule.conditions?.requiresApproval,
                    matchedRule: rule.id,
                };
            }
        }
        // No rule matched, use default
        return {
            allowed: this.defaultAction === 'allow',
            reason: `Default policy: ${this.defaultAction}`,
        };
    }
    ruleMatches(rule, context) {
        const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
        return pattern.test(context.toolName);
    }
    checkConditions(rule, context) {
        if (!rule.conditions) {
            return { met: true, reason: 'No conditions' };
        }
        if (rule.conditions.maxDepth !== undefined &&
            context.cascadeDepth > rule.conditions.maxDepth) {
            return {
                met: false,
                reason: `Cascade depth ${context.cascadeDepth} exceeds rule limit ${rule.conditions.maxDepth}`,
            };
        }
        if (rule.conditions.maxTokens !== undefined &&
            context.estimatedTokens !== undefined &&
            context.estimatedTokens > rule.conditions.maxTokens) {
            return {
                met: false,
                reason: `Estimated tokens ${context.estimatedTokens} exceeds rule limit ${rule.conditions.maxTokens}`,
            };
        }
        if (rule.conditions.allowedRoles &&
            context.userRole &&
            !rule.conditions.allowedRoles.includes(context.userRole)) {
            return {
                met: false,
                reason: `User role '${context.userRole}' not in allowed roles`,
            };
        }
        return { met: true, reason: 'All conditions met' };
    }
    setDefaultAction(action) {
        this.defaultAction = action;
    }
    setCascadeDepthLimit(limit) {
        this.cascadeDepthLimit = limit;
    }
    isToolAllowed(toolName) {
        const context = {
            toolName,
            userId: 'system',
            cascadeDepth: 0,
        };
        return this.evaluate(context).allowed;
    }
    validateExecution(context) {
        return this.evaluate(context);
    }
}
export function createDefaultSecurityPolicy() {
    return new WaylandSecurityPolicy('allow', 10);
}
export function createRestrictiveSecurityPolicy() {
    const policy = new WaylandSecurityPolicy('deny', 5);
    return policy;
}
//# sourceMappingURL=wayland-security-policy.js.map