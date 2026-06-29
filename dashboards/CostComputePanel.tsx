import React, { useState, useEffect } from 'react';

interface UsageSummary {
  dailyTokens: number;
  dailyCost: number;
  weeklyTokens: number;
  weeklyCost: number;
  emaTokens: number;
  emaCost: number;
  byStage: Record<string, number>;
  byAgent: Record<string, { tokens: number; cost: number; savings?: number }>;
}

interface AgentBurn {
  [agent: string]: { tokens: number; cost: number };
}

interface LocalROI {
  dailySavings: number;
  weeklySavings: number;
  gpuCostPerDay: number;
  roi: number;
}

export const CostComputePanel: React.FC<{ apiBaseUrl?: string }> = ({
  apiBaseUrl = 'http://localhost:3000',
}) => {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [agents, setAgents] = useState<AgentBurn>({});
  const [roi, setRoi] = useState<LocalROI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usageRes, agentsRes, roiRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/usage-summary`),
        fetch(`${apiBaseUrl}/api/agent-burn`),
        fetch(`${apiBaseUrl}/api/local-roi`),
      ]);

      if (!usageRes.ok || !agentsRes.ok || !roiRes.ok) {
        throw new Error('Failed to fetch cost data');
      }

      const usageData = await usageRes.json();
      const agentsData = await agentsRes.json();
      const roiData = await roiRes.json();

      setUsage(usageData);
      setAgents(agentsData);
      setRoi(roiData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [apiBaseUrl]);

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#0d0d0d',
    color: '#e0e0e0',
    padding: '20px',
    borderRadius: '8px',
    fontFamily: 'monospace',
    fontSize: '14px',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#1a1a1a',
    border: '1px solid #00ff88',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '16px',
  };

  const headerStyle: React.CSSProperties = {
    color: '#00ff88',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #333',
  };

  const labelStyle: React.CSSProperties = {
    color: '#999',
  };

  const valueStyle: React.CSSProperties = {
    color: '#fff',
    fontWeight: 'bold',
  };

  if (loading && !usage) {
    return (
      <div style={panelStyle}>
        <p style={{ color: '#00ff88' }}>Loading cost data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={panelStyle}>
        <p style={{ color: '#ff6b6b' }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Usage & Cost (24h) Card */}
      <div style={cardStyle}>
        <div style={headerStyle}>📊 Usage & Cost (24h)</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Tokens</span>
          <span style={valueStyle}>{usage?.dailyTokens.toLocaleString() || 0}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Cost (USD)</span>
          <span style={valueStyle}>${usage?.dailyCost.toFixed(4) || '0.0000'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>EMA Cost (USD)</span>
          <span style={valueStyle}>${usage?.emaCost.toFixed(4) || '0.0000'}</span>
        </div>
        {usage?.byStage && Object.keys(usage.byStage).length > 0 && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333' }}>
            <div style={{ ...headerStyle, fontSize: '12px', marginBottom: '8px' }}>By Stage</div>
            {Object.entries(usage.byStage).map(([stage, tokens]) => (
              <div key={stage} style={rowStyle}>
                <span style={labelStyle}>{stage}</span>
                <span style={valueStyle}>{tokens.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-Agent Burn Card */}
      <div style={cardStyle}>
        <div style={headerStyle}>🔥 Agent Burn (24h)</div>
        {Object.entries(agents).length > 0 ? (
          <div>
            {Object.entries(agents).map(([agent, data]) => (
              <div key={agent} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #333' }}>
                <div style={{ ...headerStyle, fontSize: '12px', color: '#00ccff' }}>{agent}</div>
                <div style={rowStyle}>
                  <span style={labelStyle}>Tokens</span>
                  <span style={valueStyle}>{data.tokens.toLocaleString()}</span>
                </div>
                <div style={rowStyle}>
                  <span style={labelStyle}>Cost (USD)</span>
                  <span style={valueStyle}>${data.cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#999' }}>No agent activity</p>
        )}
      </div>

      {/* Local Model ROI Card */}
      <div style={cardStyle}>
        <div style={headerStyle}>💰 Local Model ROI</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Daily Savings (USD)</span>
          <span style={{ ...valueStyle, color: '#4ade80' }}>
            ${roi?.dailySavings.toFixed(4) || '0.0000'}
          </span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>GPU Cost/Day (USD)</span>
          <span style={valueStyle}>${roi?.gpuCostPerDay.toFixed(4) || '0.0000'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>ROI Multiplier</span>
          <span style={{ ...valueStyle, color: roi && roi.roi > 1 ? '#4ade80' : '#999' }}>
            {roi?.roi.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Last updated */}
      <div style={{ textAlign: 'center', color: '#666', fontSize: '12px', marginTop: '16px' }}>
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default CostComputePanel;
