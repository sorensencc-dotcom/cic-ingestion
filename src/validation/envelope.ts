export interface AdapterError {
  code: string;
  message: string;
  details?: unknown;
}

export interface AdapterResponse<T> {
  ok: boolean;
  data?: T;
  error?: AdapterError;
  meta: {
    adapter: string;
    durationMs: number;
    timestamp: string;
  };
}

export function makeSuccess<T>(
  data: T,
  adapter: string,
  start: number,
): AdapterResponse<T> {
  return {
    ok: true,
    data,
    meta: {
      adapter,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
  };
}

export function makeError<T>(
  code: string,
  details: unknown,
  adapter: string,
  start: number,
): AdapterResponse<T> {
  return {
    ok: false,
    error: {
      code,
      message: code,
      details,
    },
    meta: {
      adapter,
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    },
  };
}
