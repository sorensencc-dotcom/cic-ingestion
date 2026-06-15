import { MemoryEvent } from "../store/memory-store.types";
export declare class MemoryIntegrity {
    computeChecksum(event: Omit<MemoryEvent, "checksum">): string;
    validateChecksum(event: MemoryEvent): boolean;
}
//# sourceMappingURL=memory-integrity.d.ts.map