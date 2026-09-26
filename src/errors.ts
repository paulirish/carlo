export type JsonValue = string | number | boolean | null | readonly JsonValue[] | {
  readonly [key: string]: JsonValue;
};

export type CarloErrorCode =
  | 'ERR_INVALID_OPTIONS' | 'ERR_BROWSER_NOT_FOUND'
  | 'ERR_BROWSER_LAUNCH_FAILED' | 'ERR_BROWSER_CLOSED'
  | 'ERR_MANAGED_BROWSER_NOT_INSTALLED' | 'ERR_PROFILE_IN_USE'
  | 'ERR_CONTENT_NOT_FOUND' | 'ERR_CONTENT_LOAD_FAILED'
  | 'ERR_UNTRUSTED_DOCUMENT' | 'ERR_NAVIGATION_FAILED'
  | 'ERR_NAVIGATION_TIMEOUT' | 'ERR_NAVIGATION_SUPERSEDED'
  | 'ERR_BRIDGE_INIT_FAILED' | 'ERR_BRIDGE_PROTOCOL'
  | 'ERR_CAPABILITY_NOT_FOUND' | 'ERR_CAPABILITY_FAILED'
  | 'ERR_INVALID_VALUE' | 'ERR_DOCUMENT_REPLACED'
  | 'ERR_WINDOW_CLOSED' | 'ERR_APP_CLOSED'
  | 'ERR_CLEANUP_FAILED' | 'ERR_UNSUPPORTED';

export class CarloError extends Error {
  readonly code: CarloErrorCode;
  readonly operation: string;
  readonly details?: Readonly<Record<string, JsonValue>>;

  constructor(code: CarloErrorCode, operation: string, message: string, options: {
    readonly cause?: unknown;
    readonly details?: Readonly<Record<string, JsonValue>>;
  } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'CarloError';
    this.code = code;
    this.operation = operation;
    if (options.details !== undefined) this.details = Object.freeze({...options.details});
  }
}

export function carloError(
  code: CarloErrorCode,
  operation: string,
  message: string,
  cause?: unknown,
  details?: Readonly<Record<string, JsonValue>>,
): CarloError {
  return new CarloError(code, operation, message, {...(cause === undefined ? {} : {cause}), ...(details === undefined ? {} : {details})});
}
