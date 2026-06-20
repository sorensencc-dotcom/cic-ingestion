/**
 * Timeline View Component (Phase 23.6.2)
 * Renders chronological event timeline with grouping and detail panels
 */
import React from 'react';
import { TimelineEvent, DriftMetric } from '../models/TimelineEvent';
interface TimelineViewProps {
    events: TimelineEvent[];
    driftMetrics: DriftMetric[];
    selectedEvent?: TimelineEvent;
    onEventClick: (event: TimelineEvent) => void;
    isLoading: boolean;
}
export declare const TimelineView: React.FC<TimelineViewProps>;
export {};
//# sourceMappingURL=TimelineView.d.ts.map