import QdrantClient from "./qdrantClient.js";
export interface ContextItem {
    id: string;
    vector: number[];
    summary: string;
    kind: string;
    docId?: string;
    metadata?: Record<string, unknown>;
}
export declare class ContextStoreWriter {
    #private;
    constructor(client: QdrantClient);
    write(item: ContextItem): Promise<void>;
}
export default ContextStoreWriter;
//# sourceMappingURL=contextStoreWriter.d.ts.map