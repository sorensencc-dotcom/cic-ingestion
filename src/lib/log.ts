export function debug(msg: string): void {
  console.debug(msg);
}

export function info(msg: string): void {
  console.log(msg);
}

export function error(msg: string): void {
  console.error(msg);
}

export function logStructured(source: string, data: Record<string, unknown>): void {
  console.log(JSON.stringify({ source, ...data }));
}
