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
export declare const HealthIndicators: React.FC<HealthIndicatorsProps>;
export {};
//# sourceMappingURL=HealthIndicators.d.ts.map