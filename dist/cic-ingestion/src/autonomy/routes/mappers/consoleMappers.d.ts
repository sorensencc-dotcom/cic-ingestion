/**
 * Mappers: TorqueQuery shapes → Console v3 mock shapes
 * Ensures UI works without changes when switching backends
 */
export interface TorqueHealth {
    status: 'healthy' | 'degraded' | 'down';
    uptime: number;
    services: Array<{
        name: string;
        status: string;
        latencyMs?: number;
    }>;
    timestamp: string;
}
export interface ConsoleHealth {
    status: 'green' | 'yellow' | 'red';
    uptimePercent: number;
    activeServices: number;
    lastErrorAt: string | null;
}
export declare function mapTorqueHealthToConsole(torque: any): ConsoleHealth;
export interface TorquePipeline {
    id: string;
    name: string;
    state: string;
    progress?: number;
    eta?: number;
}
export interface ConsolePipeline {
    id: string;
    name: string;
    progressPercent: number;
    etaSeconds: number | null;
    status: 'running' | 'complete' | 'failed';
}
export declare function mapTorquePipelinesToConsole(torque: any): ConsolePipeline[];
export interface TorqueAlert {
    id: string;
    severity: string;
    message: string;
    createdAt: string;
    source: string;
}
export interface ConsoleAlert {
    id: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    timestamp: string;
    source: string;
}
export declare function mapTorqueAlertsToConsole(torque: any): ConsoleAlert[];
export interface TorqueWorkspace {
    userId?: string;
    userName?: string;
    userEmail?: string;
    permissions?: Array<{
        name: string;
        granted: boolean;
    }>;
    activities?: Array<{
        id: string;
        action: string;
        timestamp: string;
        actor: string;
    }>;
}
export interface ConsoleWorkspace {
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    permissions: Array<{
        name: string;
        granted: boolean;
    }>;
    activityLog: Array<{
        id: string;
        action: string;
        timestamp: string;
        actor: string;
    }>;
}
export declare function mapTorqueWorkspaceToConsole(torque: any): ConsoleWorkspace;
export interface TorqueAgent {
    id: string;
    name: string;
    status: string;
    lastActivityAt?: string;
    costLast5m?: number;
    heartbeat?: {
        latencyMs: number;
        lastPulse: string;
    };
}
export interface ConsoleAgent {
    id: string;
    name: string;
    status: 'online' | 'degraded' | 'offline';
    lastExecution: string;
    costLast5m: number;
    heartbeat: {
        latencyMs: number;
        lastPulse: string;
    };
}
export declare function mapTorqueAgentsToConsole(torque: any): ConsoleAgent[];
export interface TorqueAgentDetail {
    id: string;
    name: string;
    version?: string;
    region?: string;
    capabilities?: string[];
    heartbeat?: any;
    costTimeline?: any[];
    executionLog?: any[];
    approvalHistory?: any[];
    skillUsage?: any[];
}
export interface ConsoleAgentDetail {
    id: string;
    metadata: {
        name: string;
        version: string;
        region: string;
        capabilities: string[];
    };
    heartbeat: {
        latencyMs: number;
        queueDepth: number;
        health: string;
        lastPulse: string;
    };
    costTimeline: Array<{
        timestamp: string;
        cost: number;
    }>;
    executionLog: any[];
    approvalHistory: any[];
    skillUsage: any[];
}
export declare function mapTorqueAgentDetailToConsole(torque: any): ConsoleAgentDetail;
//# sourceMappingURL=consoleMappers.d.ts.map