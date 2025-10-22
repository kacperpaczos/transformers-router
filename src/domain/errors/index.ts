/**
 * Domain-specific error classes for Transformers Router
 * These errors represent business logic failures and should be caught and handled appropriately
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ModelUnavailableError extends Error {
  constructor(
    message: string,
    public model: string,
    public modality: string
  ) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}

export class ModelLoadError extends Error {
  constructor(
    message: string,
    public model: string,
    public modality: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ModelLoadError';
  }
}

export class ModelNotLoadedError extends Error {
  constructor(
    message: string,
    public model: string,
    public modality: string
  ) {
    super(message);
    this.name = 'ModelNotLoadedError';
  }
}

export class InferenceError extends Error {
  constructor(
    message: string,
    public modality: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'InferenceError';
  }
}

export class InitializationError extends Error {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'InitializationError';
  }
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public configField?: string
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
