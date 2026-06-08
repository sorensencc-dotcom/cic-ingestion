/**
 * Correlation Tracer Component (Phase 23.6.4)
 * Reconstructs and displays correlation traces for event debugging and auditing
 */

import React, { useState, useEffect } from 'react';
import { CorrelationTrace } from '../models/TimelineEvent';
import { ExplorerClient } from '../queries/ExplorerQueries';

interface CorrelationTracerProps {
  client: ExplorerClient;
  correlationId: string;
  onClose: () => void;
}

export const CorrelationTracer: React.FC<CorrelationTracerProps> = ({
  client,
  correlationId,
  onClose,
}) => {
  const [trace, setTrace] = useState<CorrelationTrace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrace = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await client.getCorrelationTrace(correlationId);
        setTrace(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadTrace();
  }, [correlationId, client]);

  if (isLoading) {
    return <div className="tracer-loading">Loading trace...</div>;
  }

  if (error) {
    return (
      <div className="tracer-error">
        <div className="error-title">Error loading trace</div>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!trace) {
    return <div className="tracer-empty">No trace data</div>;
  }

  const durationSeconds = Math.floor(trace.duration / 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);

  return (
    <div className="correlation-tracer">
      <div className="tracer-header">
        <div className="tracer-title">
          <h4>Correlation Trace</h4>
          <span className="correlation-id">{correlationId}</span>
        </div>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="tracer-summary">
        <div className="summary-item">
          <span className="summary-label">Events:</span>
          <span className="summary-value">{trace.timeline.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Duration:</span>
          <span className="summary-value">
            {durationMinutes > 0
              ? `${durationMinutes}m ${durationSeconds % 60}s`
              : `${durationSeconds}s`}
          </span>
        </div>
      </div>

      {trace.criticalPath && trace.criticalPath.length > 0 && (
        <div className="critical-path">
          <div className="path-label">Critical Path</div>
          <div className="path-events">
            {trace.criticalPath.map((event, idx) => (
              <div key={idx} className="path-event">
                <span className="path-type">{event.type}</span>
                {idx < trace.criticalPath!.length - 1 && (
                  <span className="path-arrow">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tracer-timeline">
        <div className="timeline-label">Event Sequence</div>
        {trace.timeline.map((event, idx) => (
          <div key={idx} className="trace-event">
            <div className="event-marker">{idx + 1}</div>
            <div className="event-content">
              <div className="event-info">
                <span className="event-type">{event.type}</span>
                <time className="event-time">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </time>
              </div>
              <div className="event-summary">{event.summary}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="tracer-actions">
        <button className="btn btn-secondary">Export JSON</button>
        <button className="btn btn-secondary">Copy ID</button>
      </div>

      <style jsx>{`
        .correlation-tracer {
          background: #fff;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .tracer-loading,
        .tracer-empty,
        .tracer-error {
          padding: 20px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        .tracer-error {
          background: #fee;
          color: #c33;
        }

        .error-title {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .error-message {
          font-size: 12px;
        }

        .tracer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .tracer-title {
          display: flex;
          flex-direction: column;
        }

        .tracer-title h4 {
          margin: 0;
          font-size: 14px;
          color: #333;
        }

        .correlation-id {
          font-size: 11px;
          color: #999;
          font-family: monospace;
          margin-top: 2px;
        }

        .close-btn {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 16px;
        }

        .close-btn:hover {
          color: #333;
        }

        .tracer-summary {
          display: flex;
          gap: 16px;
          padding: 10px 12px;
          background: #f9f9f9;
          border-bottom: 1px solid #e0e0e0;
          font-size: 12px;
        }

        .summary-item {
          display: flex;
          gap: 4px;
        }

        .summary-label {
          color: #666;
          font-weight: 600;
        }

        .summary-value {
          color: #333;
          font-weight: bold;
        }

        .critical-path {
          padding: 10px 12px;
          background: #f0f7ff;
          border-bottom: 1px solid #e0e0e0;
        }

        .path-label {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .path-events {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          font-size: 11px;
        }

        .path-event {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .path-type {
          background: #e3f2fd;
          color: #1976d2;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 500;
        }

        .path-arrow {
          color: #999;
        }

        .tracer-timeline {
          flex: 1;
          overflow-y: auto;
          padding: 8px 12px;
        }

        .timeline-label {
          font-size: 11px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #e0e0e0;
        }

        .trace-event {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }

        .trace-event:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .event-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          background: #e3f2fd;
          color: #1976d2;
          border-radius: 50%;
          font-weight: bold;
          font-size: 12px;
        }

        .event-content {
          flex: 1;
          min-width: 0;
        }

        .event-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .event-type {
          font-weight: 600;
          color: #333;
        }

        .event-time {
          font-family: monospace;
          font-size: 11px;
          color: #999;
        }

        .event-summary {
          font-size: 12px;
          color: #555;
          line-height: 1.3;
          word-break: break-word;
        }

        .tracer-actions {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid #e0e0e0;
          background: #fafafa;
        }

        .btn {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          background: #fff;
          color: #333;
          transition: all 0.2s;
        }

        .btn:hover {
          background: #f5f5f5;
        }

        .btn-secondary {
          background: #f9f9f9;
        }
      `}</style>
    </div>
  );
};
