export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}
