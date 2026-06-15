import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Memory Explorer Layout (Phase 23.6)
 * Main container for timeline, drift overlays, health indicators, and correlation tracing
 */
import { useState, useEffect } from 'react';
import { TimelineView } from './TimelineView';
import { DriftOverlay } from './DriftOverlay';
import { HealthIndicators } from './HealthIndicators';
import { CorrelationTracer } from './CorrelationTracer';
import { FilterPanel } from './FilterPanel';
import { ExplorerClient } from '../queries/ExplorerQueries';
export const ExplorerLayout = ({ apiBaseUrl, pollInterval = 5000, }) => {
    const [state, setState] = useState({
        events: [],
        driftMetrics: [],
        healthMetrics: [],
        filter: {
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // last 7 days
            endDate: new Date(),
        },
        isLoading: true,
    });
    const [client] = useState(() => new ExplorerClient({ baseUrl: apiBaseUrl, pollInterval }));
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
            }
            catch (err) {
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
    const handleEventClick = (event) => {
        setState((prev) => ({
            ...prev,
            selectedEvent: event,
            selectedCorrelationId: event.correlationId,
        }));
    };
    const handleFilterChange = (filter) => {
        setState((prev) => ({
            ...prev,
            filter,
            events: [], // clear events, will reload
        }));
    };
    const _handleCorrelationSelect = (correlationId) => {
        setState((prev) => ({
            ...prev,
            selectedCorrelationId: correlationId,
        }));
    };
    return (_jsxs("div", { className: "explorer-layout", children: [_jsxs("header", { className: "explorer-header", children: [_jsx("h1", { children: "CIC Memory Explorer" }), _jsx("p", { className: "subtitle", children: "Timeline of CIC events, drift metrics, health indicators, and correlation traces" })] }), _jsxs("div", { className: "explorer-container", children: [_jsxs("aside", { className: "explorer-sidebar", children: [_jsx(FilterPanel, { currentFilter: state.filter, onFilterChange: handleFilterChange, isLoading: state.isLoading }), _jsx(HealthIndicators, { metrics: state.healthMetrics, isLoading: state.isLoading }), state.error && (_jsxs("div", { className: "error-panel", children: [_jsx("strong", { children: "Error:" }), " ", state.error] }))] }), _jsxs("main", { className: "explorer-main", children: [_jsxs("div", { className: "timeline-section", children: [_jsx(TimelineView, { events: state.events, driftMetrics: state.driftMetrics, selectedEvent: state.selectedEvent, onEventClick: handleEventClick, isLoading: state.isLoading }), _jsx(DriftOverlay, { metrics: state.driftMetrics, isLoading: state.isLoading })] }), state.selectedCorrelationId && (_jsx("div", { className: "correlation-section", children: _jsx(CorrelationTracer, { client: client, correlationId: state.selectedCorrelationId, onClose: () => setState((prev) => ({
                                        ...prev,
                                        selectedCorrelationId: undefined,
                                    })) }) })), state.selectedEvent && (_jsx("div", { className: "event-detail-section", children: _jsx(EventDetailPanel, { event: state.selectedEvent, onClose: () => setState((prev) => ({
                                        ...prev,
                                        selectedEvent: undefined,
                                    })) }) }))] })] }), _jsx("style", { jsx: true, children: `
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
      ` })] }));
};
const EventDetailPanel = ({ event, onClose, }) => {
    return (_jsxs("div", { className: "event-detail", children: [_jsxs("div", { className: "event-detail-header", children: [_jsx("h3", { children: event.summary }), _jsx("button", { onClick: onClose, className: "close-btn", children: "\u2715" })] }), _jsxs("div", { className: "event-detail-body", children: [_jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Type:" }), _jsx("span", { className: "value", children: event.type })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Severity:" }), _jsx("span", { className: `value severity-${event.severity}`, children: event.severity })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Time:" }), _jsx("span", { className: "value", children: new Date(event.timestamp).toLocaleString() })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Correlation ID:" }), _jsx("span", { className: "value code", children: event.correlationId })] }), event.sessionId && (_jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "label", children: "Session:" }), _jsx("span", { className: "value code", children: event.sessionId })] }))] }), _jsx("style", { jsx: true, children: `
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
      ` })] }));
};
//# sourceMappingURL=ExplorerLayout.js.map