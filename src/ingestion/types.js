// Phase 27 — Ingestion Autonomy: Core type definitions
export class FileLockedError extends Error {
    constructor(message = "Manifest file is locked by another process") {
        super(message);
        this.name = "FileLockedError";
    }
}
