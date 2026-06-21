/**
 * Phase 27: Aperture — Policy Engine
 * Declarative authorization & constraint enforcement
 */
export class PolicyEngine {
    constructor() {
        this.policies = new Map();
        this.agentLimitCounters = new Map();
        this.agentTimestamps = new Map();
    }
    /**
     * Load policy from definition
     */
    load(definition) {
        if (!definition.agent || !definition.name) {
            throw new Error('Policy must have agent and name');
        }
        if (!definition.allow || definition.allow.length === 0) {
            throw new Error(`Policy ${definition.name} must have at least one allowed adapter`);
        }
        if (!definition.limits) {
            throw new Error(`Policy ${definition.name} must define limits`);
        }
        const key = `${definition.agent}-${definition.name}`;
        this.policies.set(key, definition);
        // Initialize counters for this agent if not present
        if (!this.agentLimitCounters.has(definition.agent)) {
            this.agentLimitCounters.set(definition.agent, new Map());
            this.agentTimestamps.set(definition.agent, Date.now());
        }
    }
    /**
     * Authorize a specific operation
     */
    authorize(agent, adapterId) {
        const policy = this.getPolicyForAgent(agent);
        if (!policy) {
            return {
                allowed: false,
                reason: `No policy found for agent: ${agent}`
            };
        }
        // Check deny list first (blacklist takes precedence)
        if (policy.deny?.includes(adapterId)) {
            return {
                allowed: false,
                reason: `Adapter ${adapterId} is in deny list for ${agent}`
            };
        }
        // Check allow list
        if (!policy.allow.includes(adapterId)) {
            return {
                allowed: false,
                reason: `Adapter ${adapterId} is not in allow list for ${agent}`
            };
        }
        // Check rate limit before allowing
        const qpsCheck = this.checkLimits(agent, 'qps');
        if (!qpsCheck.ok) {
            return {
                allowed: false,
                reason: `Rate limit exceeded: ${qpsCheck.current}/${qpsCheck.limit} QPS`
            };
        }
        return {
            allowed: true,
            cost: 1
        };
    }
    /**
     * Check if operation requires approval
     */
    preApproval(agent, adapterId) {
        const policy = this.getPolicyForAgent(agent);
        if (!policy?.safety?.require_approval_for) {
            return false;
        }
        return policy.safety.require_approval_for.includes(adapterId);
    }
    /**
     * Check execution limits
     */
    checkLimits(agent, stat) {
        const policy = this.getPolicyForAgent(agent);
        if (!policy) {
            return {
                ok: false,
                current: 0,
                limit: 0
            };
        }
        const counters = this.agentLimitCounters.get(agent) || new Map();
        const current = counters.get(stat) || 0;
        let limit = 0;
        switch (stat) {
            case 'calls':
                limit = policy.limits.max_calls;
                break;
            case 'bytes':
                limit = policy.limits.max_bytes;
                break;
            case 'depth':
                limit = policy.limits.max_depth;
                break;
            case 'qps':
                limit = policy.limits.rate_limit_qps;
                break;
        }
        return {
            ok: current < limit,
            current,
            limit
        };
    }
    /**
     * Increment limit counter
     */
    incrementLimit(agent, stat, amount = 1) {
        let counters = this.agentLimitCounters.get(agent);
        if (!counters) {
            counters = new Map();
            this.agentLimitCounters.set(agent, counters);
        }
        const current = counters.get(stat) || 0;
        counters.set(stat, current + amount);
    }
    /**
     * Reset limits for agent (e.g., on invocation start)
     */
    resetLimits(agent) {
        this.agentLimitCounters.set(agent, new Map());
        this.agentTimestamps.set(agent, Date.now());
    }
    /**
     * Get approval confidence threshold
     */
    getApprovalThreshold(agent) {
        const policy = this.getPolicyForAgent(agent);
        const threshold = policy?.safety?.min_approval_confidence;
        return typeof threshold === 'number' ? threshold : 0.8;
    }
    /**
     * Get redact fields for audit logging
     */
    getRedactFields(agent) {
        const policy = this.getPolicyForAgent(agent);
        return policy?.audit?.redact_fields ?? ['Authorization', 'api_key'];
    }
    /**
     * Check if all operations should be logged
     */
    shouldLogAll(agent) {
        const policy = this.getPolicyForAgent(agent);
        return policy?.audit?.log_all ?? true;
    }
    /**
     * Check if destructive operations are allowed
     */
    allowDestructive(agent) {
        const policy = this.getPolicyForAgent(agent);
        const noDestructive = policy?.safety?.no_destructive ?? false;
        return !noDestructive;
    }
    /**
     * Get allowed domains for HTTP operations
     */
    getAllowedDomains(agent) {
        const policy = this.getPolicyForAgent(agent);
        return policy?.credentials?.allowed_domains ?? null;
    }
    /**
     * Get allowed HTTP headers
     */
    getAllowedHeaders(agent) {
        const policy = this.getPolicyForAgent(agent);
        return policy?.credentials?.http_headers ?? [];
    }
    /**
     * List all policies
     */
    listAll() {
        return Array.from(this.policies.values());
    }
    /**
     * Get policy by agent + name
     */
    getPolicy(agent, name) {
        const key = `${agent}-${name}`;
        return this.policies.get(key) || null;
    }
    /**
     * Get current policy for agent
     */
    getPolicyForAgent(agent) {
        // Find the most recent policy for this agent
        for (const [, policy] of this.policies) {
            if (policy.agent === agent) {
                return policy;
            }
        }
        return null;
    }
    /**
     * Check if adapter requires specific domain
     */
    checkDomain(agent, domain) {
        const allowed = this.getAllowedDomains(agent);
        if (!allowed) {
            return true; // No domain restriction
        }
        return allowed.includes(domain);
    }
    /**
     * Get limits for agent
     */
    getLimits(agent) {
        const policy = this.getPolicyForAgent(agent);
        return policy?.limits || null;
    }
}
/**
 * Factory: Create policy engine with default policies
 */
export function createDefaultPolicyEngine() {
    const engine = new PolicyEngine();
    // Default policy for "harvester" agent
    engine.load({
        name: 'harvester-default',
        agent: 'harvester',
        version: '1.0.0',
        allow: ['http.get', 'file.write', 'model.generate'],
        deny: ['shell.exec'],
        limits: {
            max_calls: 50,
            max_bytes: 5242880, // 5MB
            max_concurrent: 3,
            max_depth: 4,
            rate_limit_qps: 10
        },
        credentials: {
            http_headers: ['Authorization', 'User-Agent'],
            allowed_domains: ['api.example.com', 'cdn.example.com']
        },
        safety: {
            no_destructive: true,
            require_approval_for: ['file.write', 'model.generate'],
            min_approval_confidence: 0.8
        },
        audit: {
            log_all: true,
            sample_rate: 1.0,
            redact_fields: ['Authorization', 'api_key']
        }
    });
    // Default policy for "explorer" agent (read-only)
    engine.load({
        name: 'explorer-default',
        agent: 'explorer',
        version: '1.0.0',
        allow: ['http.get', 'file.read', 'browser.navigate', 'browser.extract'],
        deny: ['shell.exec', 'file.write', 'model.generate'],
        limits: {
            max_calls: 100,
            max_bytes: 10485760, // 10MB
            max_concurrent: 5,
            max_depth: 6,
            rate_limit_qps: 20
        },
        safety: {
            no_destructive: true,
            require_approval_for: [],
            min_approval_confidence: 0.9
        },
        audit: {
            log_all: true,
            sample_rate: 1.0
        }
    });
    return engine;
}
//# sourceMappingURL=PolicyEngine.js.map
