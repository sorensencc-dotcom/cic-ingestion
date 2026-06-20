/**
 * retrievalDriftDetector.ts
 * Compares current rankings against golden snapshots and raises alerts on drift.
 */
import VectorLayer from "./vectorLayer.js";
export interface DriftAlert {
    goldenId: string;
    expected: string[];
    actual: string[];
    driftScore: number;
}
export declare class RetrievalDriftDetector {
    #private;
    constructor(layer: VectorLayer);
    check(threshold?: number): Promise<DriftAlert[]>;
}
//# sourceMappingURL=retrievalDriftDetector.d.ts.map