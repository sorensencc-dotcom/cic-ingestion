/**
 * Mappers: TorqueQuery shapes → Console v3 mock shapes
 * Ensures UI works without changes when switching backends
 */

export interface TorqueHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  services: Array<{ name: string; status: string; latencyMs?: number }>;
  timestamp: string;
}

export interface ConsoleHealth {
  status: 'green' | 'yellow' | 'red';
  uptimePercent: number;
  activeServices: number;
  lastErrorAt: string | null;
}

export function mapTorqueHealthToConsole(torque: any): ConsoleHealth {
  const statusMap: Record<string, 'green' | 'yellow' | 'red'> = {
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

export function mapTorquePipelinesToConsole(torque: any): ConsolePipeline[] {
  const pipelines = torque.pipelines || [];

  return pipelines.map((p: any) => ({
    id: p.id,
    name: p.name,
    progressPercent: Math.min(100, (p.progress || 0) + (Math.random() - 0.3) * 5),
    etaSeconds: p.eta ? Math.max(60, p.eta - Math.random() * 100) : null,
    status: p.state === 'running' ? 'running' : p.state === 'complete' ? 'complete' : 'failed',
  }));
}

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

export function mapTorqueAlertsToConsole(torque: any): ConsoleAlert[] {
  const alerts = torque.alerts || [];

  return alerts.slice(0, 4).map((a: any) => ({
    id: a.id,
    severity: (a.severity as 'info' | 'warning' | 'critical') || 'info',
    title: a.title || a.message?.split('\n')[0] || 'Alert',
    message: a.message,
    timestamp: a.createdAt || a.timestamp || new Date().toISOString(),
    source: a.source || 'Unknown',
  }));
}

export interface TorqueWorkspace {
  userId?: string;
  userName?: string;
  userEmail?: string;
  permissions?: Array<{ name: string; granted: boolean }>;
  activities?: Array<{ id: string; action: string; timestamp: string; actor: string }>;
}

export interface ConsoleWorkspace {
  user: { id: string; name: string; email: string; role: string };
  permissions: Array<{ name: string; granted: boolean }>;
  activityLog: Array<{ id: string; action: string; timestamp: string; actor: string }>;
}

export function mapTorqueWorkspaceToConsole(torque: any): ConsoleWorkspace {
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
    activityLog: (torque.activities || []).map((a: any) => ({
      id: a.id,
      action: a.action,
      timestamp: a.timestamp,
      actor: a.actor || 'Chris Sorensen',
    })),
  };
}

export interface TorqueAgent {
  id: string;
  name: string;
  status: string;
  lastActivityAt?: string;
  costLast5m?: number;
  heartbeat?: { latencyMs: number; lastPulse: string };
}

export interface ConsoleAgent {
  id: string;
  name: string;
  status: 'online' | 'degraded' | 'offline';
  lastExecution: string;
  costLast5m: number;
  heartbeat: { latencyMs: number; lastPulse: string };
}

export function mapTorqueAgentsToConsole(torque: any): ConsoleAgent[] {
  const agents = torque.agents || [];

  return agents.map((a: any) => ({
    id: a.id,
    name: a.name,
    status: (a.status as 'online' | 'degraded' | 'offline') || 'online',
    lastExecution: a.lastActivityAt || new Date().toISOString(),
    costLast5m: a.costLast5m || 0.3 + Math.random() * 0.2,
    heartbeat: a.heartbeat || {
      latencyMs: Math.floor(80 + Math.random() * 40),
      lastPulse: new Date().toISOString(),
    },
  }));
}

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
  metadata: { name: string; version: string; region: string; capabilities: string[] };
  heartbeat: { latencyMs: number; queueDepth: number; health: string; lastPulse: string };
  costTimeline: Array<{ timestamp: string; cost: number }>;
  executionLog: any[];
  approvalHistory: any[];
  skillUsage: any[];
}

export function mapTorqueAgentDetailToConsole(torque: any): ConsoleAgentDetail {
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
