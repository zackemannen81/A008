export type ChatErrorCode =
  | "configuration"
  | "unknown_model"
  | "authentication"
  | "rate_limit"
  | "provider"
  | "server"
  | "timeout"
  | "cancelled"
  | "network"
  | "invalid_response";

export interface ChatErrorOptions {
  readonly status?: number;
  readonly retryable?: boolean;
  readonly cause?: unknown;
}

export class ChatError extends Error {
  readonly code: ChatErrorCode;
  readonly status: number | undefined;
  readonly retryable: boolean;

  constructor(
    code: ChatErrorCode,
    message: string,
    options: ChatErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ChatError";
    this.code = code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export function isChatError(value: unknown): value is ChatError {
  return value instanceof ChatError;
}
