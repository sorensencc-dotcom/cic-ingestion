/**
 * Drift Overlay Component (Phase 23.6.3)
 * Displays drift scores and severity indicators overlaid on timeline
 */

import React from 'react';
import { DriftMetric } from '../models/TimelineEvent';

interface DriftOverlayProps {
  metrics: DriftMetric[];
  isLoading: boolean;
}

export const DriftOverlay: React.FC<DriftOverlayProps> = ({
  metrics,
  isLoading,
}) => {
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return '#d32f2f';
      case 'warning':
        return '#f57c00';
      case 'normal':
        return '#4CAF50';
      default:
        return '#999';
    }
  };

  const getSeverityLabel = (score: number): string => {
    if (score > 0.75) return 'Critical';
    if (score > 0.5) return 'Warning';
    return 'Normal';
  };

  return (
    <div className="drift-overlay">
      <div className="drift-header">
        <h3>Drift Metrics</h3>
        {isLoading && <span className="loading-indicator">Updating...</span>}
      </div>

      {latestMetric ? (
        <div className="drift-content">
          <div className="drift-score-card">
            <div className="score-label">Combined Score</div>
            <div
              className="score-value"
              style={{
                color: getSeverityColor(latestMetric.severity),
              }}
            >
              {(latestMetric.driftScore * 100).toFixed(1)}%
            </div>
            <div className="score-severity">
              {getSeverityLabel(latestMetric.driftScore)}
            </div>
          </div>

          <div className="drift-signals">
            <div className="signal-row">
              <span className="signal-name">Semantic Drift</span>
              <div className="signal-bar">
                <div
                  className="signal-fill"
                  style={{
                    width: `${latestMetric.signals.semantic_drift * 100}%`,
                    backgroundColor: getSeverityColor(
                      latestMetric.severity
                    ),
                  }}
                ></div>
              </div>
              <span className="signal-percent">
                {(latestMetric.signals.semantic_drift * 100).toFixed(0)}%
              </span>
            </div>

            <div className="signal-row">
              <span className="signal-name">Temporal Drift</span>
              <div className="signal-bar">
                <div
                  className="signal-fill"
                  style={{
                    width: `${latestMetric.signals.temporal_drift * 100}%`,
                    backgroundColor: getSeverityColor(
                      latestMetric.severity
                    ),
                  }}
                ></div>
              </div>
              <span className="signal-percent">
                {(latestMetric.signals.temporal_drift * 100).toFixed(0)}%
              </span>
            </div>

            <div className="signal-row">
              <span className="signal-name">Narrative Drift</span>
              <div className="signal-bar">
                <div
                  className="signal-fill"
                  style={{
                    width: `${latestMetric.signals.narrative_drift * 100}%`,
                    backgroundColor: getSeverityColor(
                      latestMetric.severity
                    ),
                  }}
                ></div>
              </div>
              <span className="signal-percent">
                {(latestMetric.signals.narrative_drift * 100).toFixed(0)}%
              </span>
            </div>

            <div className="signal-row">
              <span className="signal-name">Causal Drift</span>
              <div className="signal-bar">
                <div
                  className="signal-fill"
                  style={{
                    width: `${latestMetric.signals.causal_drift * 100}%`,
                    backgroundColor: getSeverityColor(
                      latestMetric.severity
                    ),
                  }}
                ></div>
              </div>
              <span className="signal-percent">
                {(latestMetric.signals.causal_drift * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="drift-timestamp">
            Updated: {new Date(latestMetric.timestamp).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="empty-state">No drift data available</div>
      )}

      <style jsx>{`
        .drift-overlay {
          background: #fff;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
          margin-top: 16px;
          overflow: hidden;
        }

        .drift-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .drift-header h3 {
          margin: 0;
          font-size: 14px;
          color: #333;
        }

        .loading-indicator {
          font-size: 12px;
          color: #999;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }

        .drift-content {
          padding: 12px;
        }

        .empty-state {
          padding: 20px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        .drift-score-card {
          text-align: center;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .score-label {
          font-size: 11px;
          font-weight: 600;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .score-value {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 4px;
        }

        .score-severity {
          font-size: 12px;
          color: #666;
        }

        .drift-signals {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .signal-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }

        .signal-name {
          min-width: 110px;
          color: #666;
          font-weight: 500;
        }

        .signal-bar {
          flex: 1;
          height: 20px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }

        .signal-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .signal-percent {
          min-width: 40px;
          text-align: right;
          color: #333;
          font-weight: 500;
        }

        .drift-timestamp {
          margin-top: 10px;
          font-size: 11px;
          color: #999;
          text-align: center;
        }
      `}</style>
    </div>
  );
};
