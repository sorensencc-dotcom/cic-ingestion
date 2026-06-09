/**
 * Correlation Tracer Component (Phase 23.6.4)
 * Reconstructs and displays correlation traces for event debugging and auditing
 */
import React from 'react';
import { ExplorerClient } from '../queries/ExplorerQueries';
interface CorrelationTracerProps {
    client: ExplorerClient;
    correlationId: string;
    onClose: () => void;
}
export declare const CorrelationTracer: React.FC<CorrelationTracerProps>;
export {};
//# sourceMappingURL=CorrelationTracer.d.ts.map