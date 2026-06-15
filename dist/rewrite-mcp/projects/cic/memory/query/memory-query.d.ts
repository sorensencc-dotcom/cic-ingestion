import { MemoryStore } from "../store/memory-store";
import { TypeQueryOptions, CorrelationQueryOptions, SessionQueryOptions, QueryResult, SessionReconstructionResult, GovernanceLineageResult } from "./memory-query.types";
export declare class MemoryQuery {
    private store;
    constructor(store: MemoryStore);
    private toEnvelope;
    queryByType(options: TypeQueryOptions): Promise<QueryResult>;
    queryByCorrelationId(options: CorrelationQueryOptions): Promise<QueryResult>;
    queryBySessionId(options: SessionQueryOptions): Promise<QueryResult>;
    reconstructSession(sessionId: string): Promise<SessionReconstructionResult>;
    governanceLineage(correlationId: string): Promise<GovernanceLineageResult>;
    getEventTimeline(days?: number): Promise<QueryResult>;
    private validateTimeRange;
    private paginate;
}
//# sourceMappingURL=memory-query.d.ts.map