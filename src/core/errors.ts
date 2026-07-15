export class MAALError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MAALError";
  }
}

export class ConfigurationError extends MAALError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ProviderError extends MAALError {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export class RoutingError extends MAALError {
  constructor(message: string) {
    super(message);
    this.name = "RoutingError";
  }
}
