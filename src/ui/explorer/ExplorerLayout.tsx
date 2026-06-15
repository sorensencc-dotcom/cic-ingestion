/**
 * Memory Explorer Layout (Phase 23.6)
 * Main container for timeline, drift overlays, health indicators, and correlation tracing
 */

import React, { useState, useEffect } from 'react';
import { TimelineView } from './TimelineView';
import { DriftOverlay } from './DriftOverlay';
import { HealthIndicators } from './HealthIndicators';
import { CorrelationTracer } from './CorrelationTracer';
import { FilterPanel } from './FilterPanel';
import {
  TimelineEvent,
  TimelineFilter,
  DriftMetric,
  HealthMetric,
} from '../models/TimelineEvent';
import { ExplorerClient } from '../queries/ExplorerQueries';

interface ExplorerLayoutProps {
  apiBaseUrl: string;
  pollInterval?: number; // ms
}

interface ExplorerState {
  events: TimelineEvent[];
  driftMetrics: DriftMetric[];
  healthMetrics: HealthMetric[];
  selectedEvent?: TimelineEvent;
  selectedCorrelationId?: string;
  filter: TimelineFilter;
  isLoading: boolean;
  error?: string;
}

export const ExplorerLayout: React.FC<ExplorerLayoutProps> = ({
  apiBaseUrl,
  pollInterval = 5000,
}) => {
  const [state, setState] = useState<ExplorerState>({
    events: [],
    driftMetrics: [],
    healthMetrics: [],
    filter: {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
      endDate: new Date(),
    },
    isLoading: true,
  });

  const [client] = useState(
    () => new ExplorerClient({ baseUrl: apiBaseUrl, pollInterval })
  );

  // Initial load and polling
  useEffect(() => {
    const loadData = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

        const [events, driftMetrics, healthMetrics] = await Promise.all([
          client.getTimeline(state.filter, 1000),
          client.getDriftMetrics('daily'),
          client.getHealthMetrics('24h'),
        ]);

        setState((prev) => ({
          ...prev,
          events,
          driftMetrics,
          healthMetrics,
          isLoading: false,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
          isLoading: false,
        }));
      }
    };

    loadData();

    // Subscribe to real-time updates
    const unsubscribe = client.subscribeToEvents((newEvent) => {
      setState((prev) => ({
        ...prev,
        events: [newEvent, ...prev.events].slice(0, 1000), // keep last 1000
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [client, state.filter]);

  const handleEventClick = (event: TimelineEvent) => {
    setState((prev) => ({
      ...prev,
      selectedEvent: event,
      selectedCorrelationId: event.correlationId,
    }));
  };

  const handleFilterChange = (filter: TimelineFilter) => {
    setState((prev) => ({
      ...prev,
      filter,
      events: [], // clear events, will reload
    }));
  };



  return (
    <div className="explorer-layout">
      <header className="explorer-header">
        <h1>CIC Memory Explorer</h1>
        <p className="subtitle">
          Timeline of CIC events, drift metrics, health indicators, and
          correlation traces
        </p>
      </header>

      <div className="explorer-container">
        {/* Left sidebar: Filters and indicators */}
        <aside className="explorer-sidebar">
          <FilterPanel
            currentFilter={state.filter}
            onFilterChange={handleFilterChange}
            isLoading={state.isLoading}
          />

          <HealthIndicators
            metrics={state.healthMetrics}
            isLoading={state.isLoading}
          />

          {state.error && (
            <div className="error-panel">
              <strong>Error:</strong> {state.error}
            </div>
          )}
        </aside>

        {/* Main content: Timeline and details */}
        <main className="explorer-main">
          {/* Timeline with drift overlay */}
          <div className="timeline-section">
            <TimelineView
              events={state.events}
              driftMetrics={state.driftMetrics}
              selectedEvent={state.selectedEvent}
              onEventClick={handleEventClick}
              isLoading={state.isLoading}
            />

            <DriftOverlay
              metrics={state.driftMetrics}
              isLoading={state.isLoading}
            />
          </div>

          {/* Correlation tracer detail panel */}
          {state.selectedCorrelationId && (
            <div className="correlation-section">
              <CorrelationTracer
                client={client}
                correlationId={state.selectedCorrelationId}
                onClose={() =>
                  setState((prev) => ({
                    ...prev,
                    selectedCorrelationId: undefined,
                  }))
                }
              />
            </div>
          )}

          {/* Event detail panel */}
          {state.selectedEvent && (
            <div className="event-detail-section">
              <EventDetailPanel
                event={state.selectedEvent}
                onClose={() =>
                  setState((prev) => ({
                    ...prev,
                    selectedEvent: undefined,
                  }))
                }
              />
            </div>
          )}
        </main>
      </div>

      <style jsx>{`
        .explorer-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
            sans-serif;
        }

        .explorer-header {
          background: #fff;
          border-bottom: 1px solid #e0e0e0;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .explorer-header h1 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }

        .explorer-header .subtitle {
          margin: 8px 0 0 0;
          font-size: 14px;
          color: #666;
        }

        .explorer-container {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .explorer-sidebar {
          width: 280px;
          background: #fff;
          border-right: 1px solid #e0e0e0;
          overflow-y: auto;
          padding: 16px;
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
        }

        .explorer-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .timeline-section {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #fff;
        }

        .correlation-section {
          flex: 0 0 300px;
          border-top: 1px solid #e0e0e0;
          overflow-y: auto;
          padding: 16px;
          background: #fafafa;
        }

        .event-detail-section {
          flex: 0 0 250px;
          border-top: 1px solid #e0e0e0;
          overflow-y: auto;
          padding: 16px;
          background: #fafafa;
        }

        .error-panel {
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 4px;
          padding: 12px;
          margin-top: 16px;
          color: #c33;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

/**
 * Event detail panel component
 */
interface EventDetailPanelProps {
  event: TimelineEvent;
  onClose: () => void;
}

const EventDetailPanel: React.FC<EventDetailPanelProps> = ({
  event,
  onClose,
}) => {
  return (
    <div className="event-detail">
      <div className="event-detail-header">
        <h3>{event.summary}</h3>
        <button onClick={onClose} className="close-btn">
          ✕
        </button>
      </div>

      <div className="event-detail-body">
        <div className="detail-row">
          <span className="label">Type:</span>
          <span className="value">{event.type}</span>
        </div>
        <div className="detail-row">
          <span className="label">Severity:</span>
          <span className={`value severity-${event.severity}`}>
            {event.severity}
          </span>
        </div>
        <div className="detail-row">
          <span className="label">Time:</span>
          <span className="value">
            {new Date(event.timestamp).toLocaleString()}
          </span>
        </div>
        <div className="detail-row">
          <span className="label">Correlation ID:</span>
          <span className="value code">{event.correlationId}</span>
        </div>
        {event.sessionId && (
          <div className="detail-row">
            <span className="label">Session:</span>
            <span className="value code">{event.sessionId}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .event-detail {
          background: #fff;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }

        .event-detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .event-detail-header h3 {
          margin: 0;
          font-size: 14px;
          color: #333;
        }

        .close-btn {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 16px;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: #333;
        }

        .event-detail-body {
          padding: 12px;
          font-size: 13px;
        }

        .detail-row {
          display: flex;
          margin-bottom: 8px;
          gap: 8px;
        }

        .label {
          min-width: 80px;
          font-weight: 500;
          color: #666;
        }

        .value {
          flex: 1;
          color: #333;
          word-break: break-word;
        }

        .value.code {
          font-family: 'Courier New', monospace;
          background: #f5f5f5;
          padding: 2px 4px;
          border-radius: 2px;
          font-size: 11px;
        }

        .severity-error {
          color: #d32f2f;
        }

        .severity-warning {
          color: #f57c00;
        }

        .severity-critical {
          color: #c62828;
        }
      `}</style>
    </div>
  );
};
