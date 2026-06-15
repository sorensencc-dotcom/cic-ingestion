import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const HealthIndicators = ({ metrics, isLoading, }) => {
    const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
    const getStatusColor = (value, threshold = 0.9) => {
        if (value >= threshold)
            return '#4CAF50';
        if (value >= threshold - 0.15)
            return '#FF9800';
        return '#d32f2f';
    };
    return (_jsxs("div", { className: "health-indicators", children: [_jsx("h3", { children: "Health Metrics" }), isLoading && _jsx("div", { className: "loading", children: "Loading..." }), latest ? (_jsxs("div", { className: "metrics-grid", children: [_jsxs("div", { className: "metric-card", children: [_jsx("div", { className: "metric-label", children: "Uptime" }), _jsxs("div", { className: "metric-value", style: { color: getStatusColor(latest.uptime) }, children: [(latest.uptime * 100).toFixed(1), "%"] })] }), _jsxs("div", { className: "metric-card", children: [_jsx("div", { className: "metric-label", children: "Success Rate" }), _jsxs("div", { className: "metric-value", style: { color: getStatusColor(latest.successRate) }, children: [(latest.successRate * 100).toFixed(1), "%"] })] }), _jsxs("div", { className: "metric-card", children: [_jsx("div", { className: "metric-label", children: "P50 Latency" }), _jsxs("div", { className: "metric-value", children: [latest.p50Latency, "ms"] })] }), _jsxs("div", { className: "metric-card", children: [_jsx("div", { className: "metric-label", children: "P99 Latency" }), _jsxs("div", { className: "metric-value", style: {
                                    color: latest.p99Latency > 1000 ? '#FF9800' : '#333',
                                }, children: [latest.p99Latency, "ms"] })] }), _jsxs("div", { className: "metric-card", children: [_jsx("div", { className: "metric-label", children: "Errors" }), _jsx("div", { className: "metric-value", style: { color: latest.errorCount > 0 ? '#d32f2f' : '#4CAF50' }, children: latest.errorCount })] }), _jsxs("div", { className: "metric-card", children: [_jsx("div", { className: "metric-label", children: "Events" }), _jsx("div", { className: "metric-value", children: latest.eventCount })] })] })) : (_jsx("div", { className: "no-data", children: "No metrics available" })), _jsx("style", { jsx: true, children: `
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
      ` })] }));
};
//# sourceMappingURL=HealthIndicators.js.map