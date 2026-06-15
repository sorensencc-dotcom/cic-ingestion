import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Timeline View Component (Phase 23.6.2)
 * Renders chronological event timeline with grouping and detail panels
 */
import { useMemo } from 'react';
export const TimelineView = ({ events, driftMetrics: _driftMetrics, selectedEvent, onEventClick, isLoading, }) => {
    const groupedEvents = useMemo(() => {
        return groupEventsByHour(events);
    }, [events]);
    const eventTypeColors = {
        ARPS_DELTA: '#2196F3',
        PIPELINE_RUN: '#4CAF50',
        AGENT_TELEMETRY: '#FF9800',
        GOVERNANCE_SIGNAL: '#9C27B0',
        APR_PLAN: '#00BCD4',
        CRO_RUN: '#FF5722',
        AUTONOMY_SIGNAL: '#673AB7',
    };
    const getSeverityIcon = (severity) => {
        switch (severity) {
            case 'critical':
                return '🔴';
            case 'error':
                return '⚠️';
            case 'warning':
                return '⚡';
            default:
                return '●';
        }
    };
    return (_jsxs("div", { className: "timeline-view", children: [_jsxs("div", { className: "timeline-header", children: [_jsx("h2", { children: "Event Timeline" }), _jsxs("span", { className: "event-count", children: [events.length, " events"] })] }), isLoading && _jsx("div", { className: "loading", children: "Loading events..." }), !isLoading && events.length === 0 && (_jsx("div", { className: "empty-state", children: "No events found for selected time range" })), _jsx("div", { className: "timeline-content", children: groupedEvents.map((group) => (_jsxs("div", { className: "timeline-group", children: [_jsxs("div", { className: "group-header", children: [_jsx("time", { className: "group-time", children: group.hour }), _jsxs("span", { className: "group-count", children: [group.events.length, " events"] })] }), _jsx("div", { className: "timeline-items", children: group.events.map((event) => (_jsxs("div", { className: `timeline-item ${selectedEvent?.id === event.id ? 'selected' : ''}`, onClick: () => onEventClick(event), style: {
                                    borderLeftColor: eventTypeColors[event.type] || '#999',
                                }, children: [_jsxs("div", { className: "timeline-item-header", children: [_jsx("span", { className: "severity-icon", children: getSeverityIcon(event.severity) }), _jsx("span", { className: "event-type", children: event.type }), _jsx("time", { className: "event-time", children: new Date(event.timestamp).toLocaleTimeString() })] }), _jsx("div", { className: "timeline-item-summary", children: event.summary }), event.metadata.phase && (_jsx("span", { className: "event-badge", children: event.metadata.phase }))] }, event.id))) })] }, group.hour))) }), _jsx("style", { jsx: true, children: `
        .timeline-view {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid #e0e0e0;
        }

        .timeline-header h2 {
          margin: 0;
          font-size: 18px;
          color: #333;
        }

        .event-count {
          font-size: 13px;
          color: #999;
        }

        .loading,
        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: #999;
        }

        .timeline-content {
          flex: 1;
          overflow-y: auto;
        }

        .timeline-group {
          margin-bottom: 24px;
        }

        .group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding: 0 0 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .group-time {
          font-size: 13px;
          font-weight: 600;
          color: #666;
          font-family: 'Courier New', monospace;
        }

        .group-count {
          font-size: 12px;
          color: #999;
        }

        .timeline-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .timeline-item {
          border-left: 4px solid #ddd;
          padding: 12px;
          background: #fafafa;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .timeline-item:hover {
          background: #f0f0f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .timeline-item.selected {
          background: #e3f2fd;
          box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
        }

        .timeline-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 13px;
        }

        .severity-icon {
          font-size: 14px;
        }

        .event-type {
          font-weight: 600;
          color: #333;
          font-size: 12px;
        }

        .event-time {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #999;
          margin-left: auto;
        }

        .timeline-item-summary {
          margin: 6px 0 8px 22px;
          font-size: 13px;
          color: #555;
          line-height: 1.4;
        }

        .event-badge {
          display: inline-block;
          margin-left: 22px;
          padding: 2px 8px;
          background: #e0f2f1;
          color: #00695c;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }
      ` })] }));
};
/**
 * Helper: Group events by hour
 */
function groupEventsByHour(events) {
    const groups = {};
    for (const event of events) {
        const date = new Date(event.timestamp);
        const hourKey = date.toISOString().slice(0, 13) + ':00:00Z';
        if (!groups[hourKey]) {
            groups[hourKey] = [];
        }
        groups[hourKey].push(event);
    }
    return Object.entries(groups)
        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
        .map(([hour, eventList]) => ({
        hour: new Date(hour).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }),
        events: eventList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    }));
}
//# sourceMappingURL=TimelineView.js.map