/**
 * Health Indicators Component (Phase 23.6.3)
 * Displays uptime, success rate, latency, and error metrics
 */

import React from 'react';
import { HealthMetric } from '../models/TimelineEvent';

interface HealthIndicatorsProps {
  metrics: HealthMetric[];
  isLoading: boolean;
}

export const HealthIndicators: React.FC<HealthIndicatorsProps> = ({
  metrics,
  isLoading,
}) => {
  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  const getStatusColor = (value: number, threshold = 0.9): string => {
    if (value >= threshold) return '#4CAF50';
    if (value >= threshold - 0.15) return '#FF9800';
    return '#d32f2f';
  };

  return (
    <div className="health-indicators">
      <h3>Health Metrics</h3>

      {isLoading && <div className="loading">Loading...</div>}

      {latest ? (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Uptime</div>
            <div
              className="metric-value"
              style={{ color: getStatusColor(latest.uptime) }}
            >
              {(latest.uptime * 100).toFixed(1)}%
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Success Rate</div>
            <div
              className="metric-value"
              style={{ color: getStatusColor(latest.successRate) }}
            >
              {(latest.successRate * 100).toFixed(1)}%
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">P50 Latency</div>
            <div className="metric-value">{latest.p50Latency}ms</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">P99 Latency</div>
            <div
              className="metric-value"
              style={{
                color: latest.p99Latency > 1000 ? '#FF9800' : '#333',
              }}
            >
              {latest.p99Latency}ms
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Errors</div>
            <div
              className="metric-value"
              style={{ color: latest.errorCount > 0 ? '#d32f2f' : '#4CAF50' }}
            >
              {latest.errorCount}
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Events</div>
            <div className="metric-value">{latest.eventCount}</div>
          </div>
        </div>
      ) : (
        <div className="no-data">No metrics available</div>
      )}

      <style jsx>{`
        .health-indicators {
          margin-top: 16px;
        }

        .health-indicators h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #333;
          font-weight: 600;
        }

        .loading,
        .no-data {
          padding: 16px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .metric-card {
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 12px;
          text-align: center;
        }

        .metric-label {
          font-size: 11px;
          font-weight: 600;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 6px;
        }

        .metric-value {
          font-size: 16px;
          font-weight: bold;
          color: #333;
        }
      `}</style>
    </div>
  );
};
