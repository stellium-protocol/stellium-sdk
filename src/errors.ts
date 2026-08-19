export class StelliumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class StelliumNetworkError extends StelliumError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
  }
}

export class StelliumTransactionError extends StelliumError {
  constructor(message: string, public readonly errorResult?: unknown) {
    super(message);
  }
}
