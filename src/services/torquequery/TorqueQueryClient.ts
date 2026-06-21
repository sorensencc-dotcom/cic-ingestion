/**
 * TorqueQuery HTTP Client
 * Communicates with TorqueQuery service for Console v3 data
 */

export interface TorqueQueryClientConfig {
  url?: string;
  timeout?: number;
}

export class TorqueQueryClient {
  private url: string;
  private timeout: number;

  constructor(config: TorqueQueryClientConfig = {}) {
    this.url = config.url || process.env.TORQUE_QUERY_URL || 'http://localhost:3110';
    this.timeout = config.timeout || 5000;
  }

  private async fetch(path: string, options: RequestInit = {}): Promise<any> {
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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async queryHealth(): Promise<any> {
    return this.fetch('/health');
  }

  async queryPipelines(): Promise<any> {
    return this.fetch('/pipelines');
  }

  async queryAlerts(): Promise<any> {
    return this.fetch('/alerts');
  }

  async queryWorkspace(): Promise<any> {
    return this.fetch('/workspace');
  }

  async queryAgents(): Promise<any> {
    return this.fetch('/agents');
  }

  async queryAgentDetail(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}`);
  }

  async invokeAgent(agentId: string, payload: any): Promise<any> {
    return this.fetch(`/agents/${agentId}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async pauseAgent(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  async restartAgent(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  async snapshotAgent(agentId: string): Promise<any> {
    return this.fetch(`/agents/${agentId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  async executeAction(action: string, options: any = {}): Promise<any> {
    return this.fetch('/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...options }),
    });
  }

  async queryMetrics(): Promise<any> {
    return this.fetch('/metrics');
  }
}
