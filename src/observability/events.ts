export interface EventPayload {
  eventName:
    | "MODEL_CALL_START"
    | "MODEL_CALL_SUCCESS"
    | "MODEL_CALL_FAILURE"
    | "MODEL_CALL_EXHAUSTED"
    | "AUDIT_COMPARISON";
  model?: string;
  latencyMs?: number;
  tokensUsed?: {
    input: number;
    output: number;
  };
  error?: string;
  agent?: string;
  primaryModel?: string;
  secondaryModel?: string;
  score?: number;
  fallback?: boolean;
  [key: string]: any;
}

export function logEvent(payload: EventPayload): void {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, ...payload };

  // Log to stderr for structured observability systems to capture
  if (process.env.LOG_LEVEL === "debug") {
    console.error(JSON.stringify(entry));
  }

  // For production, wire into CIC observability layer via environment hook
  if (typeof globalThis !== "undefined" && (globalThis as any).__cicEventBus) {
    try {
      (globalThis as any).__cicEventBus.emit(payload.eventName, entry);
    } catch (e) {
      // Silently fail if event bus is not available
    }
  }
}
