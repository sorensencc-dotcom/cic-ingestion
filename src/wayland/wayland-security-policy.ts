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

export class WaylandSecurityPolicy {
  private rules: Map<string, PolicyRule> = new Map();
  private defaultAction: 'allow' | 'deny' = 'allow';
  private cascadeDepthLimit: number = 10;

  constructor(defaultAction: 'allow' | 'deny' = 'allow', depthLimit: number = 10) {
    this.defaultAction = defaultAction;
    this.cascadeDepthLimit = depthLimit;
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
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

  addRule(rule: PolicyRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRules(): PolicyRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  evaluate(context: ExecutionContext): PolicyDecision {
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

  private ruleMatches(rule: PolicyRule, context: ExecutionContext): boolean {
    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern) : rule.pattern;
    return pattern.test(context.toolName);
  }

  private checkConditions(
    rule: PolicyRule,
    context: ExecutionContext
  ): { met: boolean; reason: string } {
    if (!rule.conditions) {
      return { met: true, reason: 'No conditions' };
    }

    if (
      rule.conditions.maxDepth !== undefined &&
      context.cascadeDepth > rule.conditions.maxDepth
    ) {
      return {
        met: false,
        reason: `Cascade depth ${context.cascadeDepth} exceeds rule limit ${rule.conditions.maxDepth}`,
      };
    }

    if (
      rule.conditions.maxTokens !== undefined &&
      context.estimatedTokens !== undefined &&
      context.estimatedTokens > rule.conditions.maxTokens
    ) {
      return {
        met: false,
        reason: `Estimated tokens ${context.estimatedTokens} exceeds rule limit ${rule.conditions.maxTokens}`,
      };
    }

    if (
      rule.conditions.allowedRoles &&
      context.userRole &&
      !rule.conditions.allowedRoles.includes(context.userRole)
    ) {
      return {
        met: false,
        reason: `User role '${context.userRole}' not in allowed roles`,
      };
    }

    return { met: true, reason: 'All conditions met' };
  }

  setDefaultAction(action: 'allow' | 'deny'): void {
    this.defaultAction = action;
  }

  setCascadeDepthLimit(limit: number): void {
    this.cascadeDepthLimit = limit;
  }

  isToolAllowed(toolName: string): boolean {
    const context: ExecutionContext = {
      toolName,
      userId: 'system',
      cascadeDepth: 0,
    };
    return this.evaluate(context).allowed;
  }

  validateExecution(context: ExecutionContext): PolicyDecision {
    return this.evaluate(context);
  }
}

export function createDefaultSecurityPolicy(): WaylandSecurityPolicy {
  return new WaylandSecurityPolicy('allow', 10);
}

export function createRestrictiveSecurityPolicy(): WaylandSecurityPolicy {
  const policy = new WaylandSecurityPolicy('deny', 5);
  return policy;
}
