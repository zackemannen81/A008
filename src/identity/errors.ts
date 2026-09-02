export type IdentityErrorCode =
  | "invalid_id"
  | "wrong_kind"
  | "invalid_external_reference"
  | "identity_conflict";

export class IdentityError extends Error {
  readonly code: IdentityErrorCode;

  constructor(code: IdentityErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IdentityError";
    this.code = code;
  }
}

export function isIdentityError(value: unknown): value is IdentityError {
  return value instanceof IdentityError;
}
