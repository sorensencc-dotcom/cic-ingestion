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
export declare const DriftOverlay: React.FC<DriftOverlayProps>;
export {};
//# sourceMappingURL=DriftOverlay.d.ts.map