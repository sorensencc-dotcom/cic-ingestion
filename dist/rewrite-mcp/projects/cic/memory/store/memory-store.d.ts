import { MemoryEvent, EventType, CreateMemoryEventInput } from "./memory-store.types";
export declare class MemoryStore {
    private storePath;
    private lockPath;
    private validator;
    private integrity;
    private writeBuffer;
    private writeBufferSize;
    constructor(storePath?: string);
    private ensureStorePath;
    append(event: CreateMemoryEventInput): Promise<MemoryEvent>;
    private flush;
    flush_sync(): Promise<void>;
    private readStore;
    query(eventType?: EventType, dateFrom?: string, dateTo?: string): Promise<MemoryEvent[]>;
    queryRecent(days?: number): Promise<MemoryEvent[]>;
    private getLastEvent;
    private acquireLock;
    private releaseLock;
    getStats(): Promise<{
        total_events: number;
        by_type: Record<EventType, number>;
        oldest_event: string | null;
        newest_event: string | null;
        store_size_mb: number;
    }>;
}
//# sourceMappingURL=memory-store.d.ts.map