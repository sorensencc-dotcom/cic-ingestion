/**
 * Filter Panel Component (Phase 23.6)
 * Timeline filters: date range, event types, severity
 */
import React from 'react';
import { TimelineFilter } from '../models/TimelineEvent';
interface FilterPanelProps {
    currentFilter: TimelineFilter;
    onFilterChange: (filter: TimelineFilter) => void;
    isLoading: boolean;
}
export declare const FilterPanel: React.FC<FilterPanelProps>;
export {};
//# sourceMappingURL=FilterPanel.d.ts.map