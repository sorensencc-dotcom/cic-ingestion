import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const DriftOverlay = ({ metrics, isLoading, }) => {
    const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
    const getSeverityColor = (severity) => {
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
    const getSeverityLabel = (score) => {
        if (score > 0.75)
            return 'Critical';
        if (score > 0.5)
            return 'Warning';
        return 'Normal';
    };
    return (_jsxs("div", { className: "drift-overlay", children: [_jsxs("div", { className: "drift-header", children: [_jsx("h3", { children: "Drift Metrics" }), isLoading && _jsx("span", { className: "loading-indicator", children: "Updating..." })] }), latestMetric ? (_jsxs("div", { className: "drift-content", children: [_jsxs("div", { className: "drift-score-card", children: [_jsx("div", { className: "score-label", children: "Combined Score" }), _jsxs("div", { className: "score-value", style: {
                                    color: getSeverityColor(latestMetric.severity),
                                }, children: [(latestMetric.driftScore * 100).toFixed(1), "%"] }), _jsx("div", { className: "score-severity", children: getSeverityLabel(latestMetric.driftScore) })] }), _jsxs("div", { className: "drift-signals", children: [_jsxs("div", { className: "signal-row", children: [_jsx("span", { className: "signal-name", children: "Semantic Drift" }), _jsx("div", { className: "signal-bar", children: _jsx("div", { className: "signal-fill", style: {
                                                width: `${latestMetric.signals.semantic_drift * 100}%`,
                                                backgroundColor: getSeverityColor(latestMetric.severity),
                                            } }) }), _jsxs("span", { className: "signal-percent", children: [(latestMetric.signals.semantic_drift * 100).toFixed(0), "%"] })] }), _jsxs("div", { className: "signal-row", children: [_jsx("span", { className: "signal-name", children: "Temporal Drift" }), _jsx("div", { className: "signal-bar", children: _jsx("div", { className: "signal-fill", style: {
                                                width: `${latestMetric.signals.temporal_drift * 100}%`,
                                                backgroundColor: getSeverityColor(latestMetric.severity),
                                            } }) }), _jsxs("span", { className: "signal-percent", children: [(latestMetric.signals.temporal_drift * 100).toFixed(0), "%"] })] }), _jsxs("div", { className: "signal-row", children: [_jsx("span", { className: "signal-name", children: "Narrative Drift" }), _jsx("div", { className: "signal-bar", children: _jsx("div", { className: "signal-fill", style: {
                                                width: `${latestMetric.signals.narrative_drift * 100}%`,
                                                backgroundColor: getSeverityColor(latestMetric.severity),
                                            } }) }), _jsxs("span", { className: "signal-percent", children: [(latestMetric.signals.narrative_drift * 100).toFixed(0), "%"] })] }), _jsxs("div", { className: "signal-row", children: [_jsx("span", { className: "signal-name", children: "Causal Drift" }), _jsx("div", { className: "signal-bar", children: _jsx("div", { className: "signal-fill", style: {
                                                width: `${latestMetric.signals.causal_drift * 100}%`,
                                                backgroundColor: getSeverityColor(latestMetric.severity),
                                            } }) }), _jsxs("span", { className: "signal-percent", children: [(latestMetric.signals.causal_drift * 100).toFixed(0), "%"] })] })] }), _jsxs("div", { className: "drift-timestamp", children: ["Updated: ", new Date(latestMetric.timestamp).toLocaleString()] })] })) : (_jsx("div", { className: "empty-state", children: "No drift data available" })), _jsx("style", { jsx: true, children: `
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
      ` })] }));
};
//# sourceMappingURL=DriftOverlay.js.map
