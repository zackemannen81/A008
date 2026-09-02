export type MemoryErrorCode =
  | "invalid_input"
  | "duplicate_id"
  | "missing_target"
  | "illegal_state"
  | "stale_state"
  | "policy"
  | "required_not_found"
  | "required_not_eligible"
  | "budget_exceeded";

export class MemoryError extends Error {
  readonly code: MemoryErrorCode;

  constructor(code: MemoryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MemoryError";
    this.code = code;
  }
}

export function isMemoryError(value: unknown): value is MemoryError {
  return value instanceof MemoryError;
}
