export interface Result<T, E> {
  readonly isOk: boolean;
  readonly isErr: boolean;
  map<U>(fn: (val: T) => U): Result<U, E>;
  mapErr<F>(fn: (err: E) => F): Result<T, F>;
  unwrap(): T;
  unwrapErr(): E;
}

export class Ok<T, E = never> implements Result<T, E> {
  constructor(private value: T) {}

  get isOk(): boolean {
    return true;
  }

  get isErr(): boolean {
    return false;
  }

  map<U>(fn: (val: T) => U): Result<U, E> {
    return new Ok(fn(this.value));
  }

  mapErr<F>(_fn: (err: E) => F): Result<T, F> {
    return this as unknown as Result<T, F>;
  }

  unwrap(): T {
    return this.value;
  }

  unwrapErr(): E {
    throw new Error('Called unwrapErr on Ok');
  }
}

export class Err<T = never, E = any> implements Result<T, E> {
  constructor(private error: E) {}

  get isOk(): boolean {
    return false;
  }

  get isErr(): boolean {
    return true;
  }

  map<U>(_fn: (val: T) => U): Result<U, E> {
    return this as unknown as Result<U, E>;
  }

  mapErr<F>(fn: (err: E) => F): Result<T, F> {
    return new Err(fn(this.error)) as Result<T, F>;
  }

  unwrap(): T {
    throw new Error(`Called unwrap on Err: ${this.error}`);
  }

  unwrapErr(): E {
    return this.error;
  }
}
