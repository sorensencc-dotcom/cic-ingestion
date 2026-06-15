import * as crypto from "crypto";
export class MemoryIntegrity {
    computeChecksum(event) {
        const { checksum: _, ...eventData } = event;
        const sortedKeys = Object.keys(eventData).sort();
        const json = JSON.stringify(Object.fromEntries(sortedKeys.map((key) => [key, eventData[key]])));
        return "sha256:" + crypto.createHash("sha256").update(json).digest("hex");
    }
    validateChecksum(event) {
        if (!event.checksum) {
            console.warn("EVENT_MISSING_CHECKSUM", { event_id: event.id });
            return false;
        }
        const computed = this.computeChecksum(event);
        const matches = computed === event.checksum;
        if (!matches) {
            console.warn("CHECKSUM_MISMATCH", {
                event_id: event.id,
                expected: event.checksum,
                computed,
            });
        }
        return matches;
    }
}
//# sourceMappingURL=memory-integrity.js.map