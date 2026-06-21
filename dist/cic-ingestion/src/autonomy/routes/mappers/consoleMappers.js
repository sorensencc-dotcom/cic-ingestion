/**
 * Mappers: TorqueQuery shapes → Console v3 mock shapes
 * Ensures UI works without changes when switching backends
 */
export function mapTorqueHealthToConsole(torque) {
    const statusMap = {
        healthy: 'green',
        degraded: 'yellow',
        down: 'red',
    };
    return {
        status: statusMap[torque.status] || 'yellow',
        uptimePercent: 99.2 + Math.random() * 0.8,
        activeServices: torque.services?.length || 18 + Math.floor(Math.random() * 4),
        lastErrorAt: torque.status === 'healthy' ? null : new Date().toISOString(),
    };
}
export function mapTorquePipelinesToConsole(torque) {
    const pipelines = torque.pipelines || [];
    return pipelines.map((p) => ({
        id: p.id,
        name: p.name,
        progressPercent: Math.min(100, (p.progress || 0) + (Math.random() - 0.3) * 5),
        etaSeconds: p.eta ? Math.max(60, p.eta - Math.random() * 100) : null,
        status: p.state === 'running' ? 'running' : p.state === 'complete' ? 'complete' : 'failed',
    }));
}
export function mapTorqueAlertsToConsole(torque) {
    const alerts = torque.alerts || [];
    return alerts.slice(0, 4).map((a) => ({
        id: a.id,
        severity: a.severity || 'info',
        title: a.title || a.message?.split('\n')[0] || 'Alert',
        message: a.message,
        timestamp: a.createdAt || a.timestamp || new Date().toISOString(),
        source: a.source || 'Unknown',
    }));
}
export function mapTorqueWorkspaceToConsole(torque) {
    return {
        user: {
            id: torque.userId || 'user-001',
            name: torque.userName || 'Chris Sorensen',
            email: torque.userEmail || 'sorensencc@gmail.com',
            role: 'Operator',
        },
        permissions: torque.permissions || [
            { name: 'cic:read', granted: true },
            { name: 'cic:execute', granted: true },
            { name: 'cic:approve', granted: true },
        ],
        activityLog: (torque.activities || []).map((a) => ({
            id: a.id,
            action: a.action,
            timestamp: a.timestamp,
            actor: a.actor || 'Chris Sorensen',
        })),
    };
}
export function mapTorqueAgentsToConsole(torque) {
    const agents = torque.agents || [];
    return agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status || 'online',
        lastExecution: a.lastActivityAt || new Date().toISOString(),
        costLast5m: a.costLast5m || 0.3 + Math.random() * 0.2,
        heartbeat: a.heartbeat || {
            latencyMs: Math.floor(80 + Math.random() * 40),
            lastPulse: new Date().toISOString(),
        },
    }));
}
export function mapTorqueAgentDetailToConsole(torque) {
    return {
        id: torque.id,
        metadata: {
            name: torque.name || 'Unknown Agent',
            version: torque.version || '1.0.0',
            region: torque.region || 'us-west-2',
            capabilities: torque.capabilities || [],
        },
        heartbeat: {
            latencyMs: Math.floor(80 + Math.random() * 100),
            queueDepth: Math.floor(Math.random() * 5),
            health: 'online',
            lastPulse: new Date().toISOString(),
        },
        costTimeline: Array.from({ length: 20 }, (_, i) => ({
            timestamp: new Date(Date.now() - (20 - i) * 60000).toISOString(),
            cost: 0.2 + Math.random() * 0.3,
        })),
        executionLog: torque.executionLog || [],
        approvalHistory: torque.approvalHistory || [],
        skillUsage: torque.skillUsage || [],
    };
}
//# sourceMappingURL=consoleMappers.js.map
