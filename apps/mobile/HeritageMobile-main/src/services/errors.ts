export type ServiceErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER'
  | 'CANCELLED';

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, string>;

  constructor(code: ServiceErrorCode, message: string, opts: { retryable?: boolean; details?: Record<string, string> } = {}) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.retryable = opts.retryable ?? (code === 'NETWORK' || code === 'TIMEOUT' || code === 'SERVER');
    this.details = opts.details;
  }

  static is(e: unknown, code?: ServiceErrorCode): e is ServiceError {
    return e instanceof ServiceError && (code ? e.code === code : true);
  }
}

export function notConfigured(method: string): ServiceError {
  return new ServiceError('NOT_CONFIGURED', `HTTP adapter method "${method}" is not configured. See docs/API_HANDOFF.md.`, {
    retryable: false,
  });
}

export function errorMessage(e: unknown): string {
  if (e instanceof ServiceError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
