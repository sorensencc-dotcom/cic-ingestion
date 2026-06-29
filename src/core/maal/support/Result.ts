/**
 * Phase 4: Result<T, E> — immutable success/error wrapper.
 */

export interface Result<T, E> {
  readonly isOk: boolean;
  readonly isErr: boolean;

  ok(): T | null;
  err(): E | null;

  map<U>(fn: (t: T) => U): Result<U, E>;
  mapErr<F>(fn: (e: E) => F): Result<T, F>;

  getOrThrow(label?: string): T;
}

export class Ok<T, E> implements Result<T, E> {
  constructor(private value: T) {}

  get isOk() { return true; }
  get isErr() { return false; }

  ok() { return this.value; }
  err() { return null; }

  map<U>(fn: (t: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  mapErr<F>(_fn: (e: E) => F): Result<T, F> {
    return this as any;
  }

  getOrThrow() { return this.value; }
}

export class Err<T, E> implements Result<T, E> {
  constructor(private error: E) {}

  get isOk() { return false; }
  get isErr() { return true; }

  ok() { return null; }
  err() { return this.error; }

  map<U>(_fn: (t: T) => U): Result<U, E> {
    return this as any;
  }

  mapErr<F>(fn: (e: E) => F): Result<T, F> {
    return new Err(fn(this.error));
  }

  getOrThrow(label = "Result is Err") {
    throw new Error(`${label}: ${JSON.stringify(this.error)}`);
  }
}
