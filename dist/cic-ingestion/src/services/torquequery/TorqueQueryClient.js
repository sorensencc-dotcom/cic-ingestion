/**
 * TorqueQuery HTTP Client
 * Communicates with TorqueQuery service for Console v3 data
 */
export class TorqueQueryClient {
    constructor(config = {}) {
        this.url = config.url || process.env.TORQUE_QUERY_URL || 'http://localhost:3110';
        this.timeout = config.timeout || 5000;
    }
    async fetch(path, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(`${this.url}${path}`, {
                ...options,
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`TorqueQuery ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async queryHealth() {
        return this.fetch('/health');
    }
    async queryPipelines() {
        return this.fetch('/pipelines');
    }
    async queryAlerts() {
        return this.fetch('/alerts');
    }
    async queryWorkspace() {
        return this.fetch('/workspace');
    }
    async queryAgents() {
        return this.fetch('/agents');
    }
    async queryAgentDetail(agentId) {
        return this.fetch(`/agents/${agentId}`);
    }
    async invokeAgent(agentId, payload) {
        return this.fetch(`/agents/${agentId}/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    async pauseAgent(agentId) {
        return this.fetch(`/agents/${agentId}/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
    }
    async restartAgent(agentId) {
        return this.fetch(`/agents/${agentId}/restart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
    }
    async snapshotAgent(agentId) {
        return this.fetch(`/agents/${agentId}/snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
    }
    async executeAction(action, options = {}) {
        return this.fetch('/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...options }),
        });
    }
    async queryMetrics() {
        return this.fetch('/metrics');
    }
}
//# sourceMappingURL=TorqueQueryClient.js.map
