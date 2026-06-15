import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Correlation Tracer Component (Phase 23.6.4)
 * Reconstructs and displays correlation traces for event debugging and auditing
 */
import { useState, useEffect } from 'react';
export const CorrelationTracer = ({ client, correlationId, onClose, }) => {
    const [trace, setTrace] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const loadTrace = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const result = await client.getCorrelationTrace(correlationId);
                setTrace(result);
            }
            catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
            finally {
                setIsLoading(false);
            }
        };
        loadTrace();
    }, [correlationId, client]);
    if (isLoading) {
        return _jsx("div", { className: "tracer-loading", children: "Loading trace..." });
    }
    if (error) {
        return (_jsxs("div", { className: "tracer-error", children: [_jsx("div", { className: "error-title", children: "Error loading trace" }), _jsx("div", { className: "error-message", children: error })] }));
    }
    if (!trace) {
        return _jsx("div", { className: "tracer-empty", children: "No trace data" });
    }
    const durationSeconds = Math.floor(trace.duration / 1000);
    const durationMinutes = Math.floor(durationSeconds / 60);
    return (_jsxs("div", { className: "correlation-tracer", children: [_jsxs("div", { className: "tracer-header", children: [_jsxs("div", { className: "tracer-title", children: [_jsx("h4", { children: "Correlation Trace" }), _jsx("span", { className: "correlation-id", children: correlationId })] }), _jsx("button", { className: "close-btn", onClick: onClose, children: "\u2715" })] }), _jsxs("div", { className: "tracer-summary", children: [_jsxs("div", { className: "summary-item", children: [_jsx("span", { className: "summary-label", children: "Events:" }), _jsx("span", { className: "summary-value", children: trace.timeline.length })] }), _jsxs("div", { className: "summary-item", children: [_jsx("span", { className: "summary-label", children: "Duration:" }), _jsx("span", { className: "summary-value", children: durationMinutes > 0
                                    ? `${durationMinutes}m ${durationSeconds % 60}s`
                                    : `${durationSeconds}s` })] })] }), trace.criticalPath && trace.criticalPath.length > 0 && (_jsxs("div", { className: "critical-path", children: [_jsx("div", { className: "path-label", children: "Critical Path" }), _jsx("div", { className: "path-events", children: trace.criticalPath.map((event, idx) => (_jsxs("div", { className: "path-event", children: [_jsx("span", { className: "path-type", children: event.type }), idx < trace.criticalPath.length - 1 && (_jsx("span", { className: "path-arrow", children: "\u2192" }))] }, idx))) })] })), _jsxs("div", { className: "tracer-timeline", children: [_jsx("div", { className: "timeline-label", children: "Event Sequence" }), trace.timeline.map((event, idx) => (_jsxs("div", { className: "trace-event", children: [_jsx("div", { className: "event-marker", children: idx + 1 }), _jsxs("div", { className: "event-content", children: [_jsxs("div", { className: "event-info", children: [_jsx("span", { className: "event-type", children: event.type }), _jsx("time", { className: "event-time", children: new Date(event.timestamp).toLocaleTimeString() })] }), _jsx("div", { className: "event-summary", children: event.summary })] })] }, idx)))] }), _jsxs("div", { className: "tracer-actions", children: [_jsx("button", { className: "btn btn-secondary", children: "Export JSON" }), _jsx("button", { className: "btn btn-secondary", children: "Copy ID" })] }), _jsx("style", { jsx: true, children: `
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
      ` })] }));
};
//# sourceMappingURL=CorrelationTracer.js.map