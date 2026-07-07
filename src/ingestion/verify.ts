/**
 * Ingestion Envelope Verification
 * Validates extracted client session envelopes before state mutation.
 * Returns machine-readable error codes + human-readable reason.
 */

import { validateRequired, validateObject, ValidationError } from "../utils/validation";

export type VerifyReasonCode = "MISSING_FIELD" | "BAD_TYPE" | "EXTRACTOR_ERROR";

export interface VerifyResult {
  ok: boolean;
  reasonCode?: VerifyReasonCode;
  reason?: string;
}

/**
 * Verify extracted ingestion entry has required envelope shape.
 * Input is post-extraction (after clientSessionExtractor), not raw log line.
 * Pure function — no side effects, no state mutation.
 */
export function verifyIngestionEntry(entry: any): VerifyResult {
  try {
    validateRequired(entry, "entry");
    validateRequired(entry.id, "entry.id");
    validateRequired(entry.source, "entry.source");
    validateRequired(entry.payload, "entry.payload");

    if (typeof entry.id !== "string") {
      return {
        ok: false,
        reasonCode: "BAD_TYPE",
        reason: `entry.id must be string, got ${typeof entry.id}`,
      };
    }

    if (typeof entry.source !== "string") {
      return {
        ok: false,
        reasonCode: "BAD_TYPE",
        reason: `entry.source must be string, got ${typeof entry.source}`,
      };
    }

    if (typeof entry.payload !== "object" || entry.payload === null) {
      return {
        ok: false,
        reasonCode: "BAD_TYPE",
        reason: `entry.payload must be object, got ${typeof entry.payload}`,
      };
    }

    return { ok: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      // Distinguish missing field from type mismatch
      const msg = err.message || err.errors[0] || "";
      if (msg.includes("is required")) {
        return {
          ok: false,
          reasonCode: "MISSING_FIELD",
          reason: msg,
        };
      }
      return {
        ok: false,
        reasonCode: "BAD_TYPE",
        reason: msg,
      };
    }

    return {
      ok: false,
      reasonCode: "EXTRACTOR_ERROR",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
