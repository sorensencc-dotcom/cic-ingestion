import QdrantClient from "./qdrantClient.js";
import QdrantObservability from "./qdrantObservability.js";
export interface CICChunk {
    id: string;
    docId: string;
    sourcePath: string;
    timestamp: number;
    tags: string[];
    people: string[];
    places: string[];
    metadata: Record<string, unknown>;
    text: string;
    vector: number[];
}
export declare class HarvesterIndexer {
    #private;
    constructor(client: QdrantClient, observability?: QdrantObservability);
    indexChunk(chunk: CICChunk): Promise<void>;
    bulkIndex(chunks: CICChunk[]): Promise<void>;
}
export default HarvesterIndexer;
//# sourceMappingURL=harvesterIndexer.d.ts.map