/**
 * Filter Panel Component (Phase 23.6)
 * Timeline filters: date range, event types, severity
 */

import React, { useState } from 'react';
import { TimelineFilter, EventType } from '../models/TimelineEvent';

interface FilterPanelProps {
  currentFilter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
  isLoading: boolean;
}

const EVENT_TYPES: EventType[] = [
  'ARPS_DELTA',
  'PIPELINE_RUN',
  'AGENT_TELEMETRY',
  'GOVERNANCE_SIGNAL',
  'APR_PLAN',
  'CRO_RUN',
  'AUTONOMY_SIGNAL',
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  currentFilter,
  onFilterChange,
  isLoading,
}) => {
  const [filter, setFilter] = useState<TimelineFilter>(currentFilter);

  const handleApplyFilters = () => {
    onFilterChange(filter);
  };

  const handleResetFilters = () => {
    const newFilter: TimelineFilter = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };
    setFilter(newFilter);
    onFilterChange(newFilter);
  };

  const toggleEventType = (type: EventType) => {
    const types = filter.types || [];
    const updated = types.includes(type)
      ? types.filter((t) => t !== type)
      : [...types, type];

    setFilter({
      ...filter,
      types: updated.length > 0 ? updated : undefined,
    });
  };

  return (
    <div className="filter-panel">
      <h3>Filters</h3>

      <div className="filter-section">
        <label className="filter-label">Date Range</label>
        <div className="date-inputs">
          <input
            type="date"
            value={filter.startDate?.toISOString().split('T')[0] || ''}
            onChange={(e) =>
              setFilter({
                ...filter,
                startDate: new Date(e.target.value),
              })
            }
            disabled={isLoading}
          />
          <span className="date-separator">to</span>
          <input
            type="date"
            value={filter.endDate?.toISOString().split('T')[0] || ''}
            onChange={(e) =>
              setFilter({
                ...filter,
                endDate: new Date(e.target.value),
              })
            }
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="filter-section">
        <label className="filter-label">Event Types</label>
        <div className="event-type-list">
          {EVENT_TYPES.map((type) => (
            <label key={type} className="event-type-checkbox">
              <input
                type="checkbox"
                checked={(filter.types || []).includes(type)}
                onChange={() => toggleEventType(type)}
                disabled={isLoading}
              />
              <span>{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-actions">
        <button
          className="btn btn-primary"
          onClick={handleApplyFilters}
          disabled={isLoading}
        >
          Apply
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleResetFilters}
          disabled={isLoading}
        >
          Reset
        </button>
      </div>

      <style jsx>{`
        .filter-panel {
          background: #fff;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
          padding: 12px;
        }

        .filter-panel h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #333;
          font-weight: 600;
        }

        .filter-section {
          margin-bottom: 16px;
        }

        .filter-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .date-inputs {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .date-inputs input {
          flex: 1;
          padding: 6px;
          border: 1px solid #e0e0e0;
          border-radius: 3px;
          font-size: 12px;
        }

        .date-separator {
          font-size: 12px;
          color: #999;
        }

        .event-type-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .event-type-checkbox {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          cursor: pointer;
          user-select: none;
        }

        .event-type-checkbox input {
          cursor: pointer;
        }

        .event-type-checkbox span {
          color: #555;
        }

        .filter-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .btn {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #2196F3;
          color: white;
          border-color: #2196F3;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1976D2;
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #333;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e0e0e0;
        }
      `}</style>
    </div>
  );
};
