/**
 * TorqueQuery HTTP Client
 * Communicates with TorqueQuery service for Console v3 data
 */
export interface TorqueQueryClientConfig {
    url?: string;
    timeout?: number;
}
export declare class TorqueQueryClient {
    private url;
    private timeout;
    constructor(config?: TorqueQueryClientConfig);
    private fetch;
    queryHealth(): Promise<any>;
    queryPipelines(): Promise<any>;
    queryAlerts(): Promise<any>;
    queryWorkspace(): Promise<any>;
    queryAgents(): Promise<any>;
    queryAgentDetail(agentId: string): Promise<any>;
    invokeAgent(agentId: string, payload: any): Promise<any>;
    pauseAgent(agentId: string): Promise<any>;
    restartAgent(agentId: string): Promise<any>;
    snapshotAgent(agentId: string): Promise<any>;
    executeAction(action: string, options?: any): Promise<any>;
    queryMetrics(): Promise<any>;
}
//# sourceMappingURL=TorqueQueryClient.d.ts.map