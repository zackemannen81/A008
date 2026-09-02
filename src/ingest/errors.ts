export type SourceIngestErrorCode =
  | "unsupported_media_type"
  | "invalid_source"
  | "description_failed";

export interface SourceIngestErrorOptions {
  readonly mediaType?: string;
  readonly cause?: unknown;
}

/**
 * A source could not be turned into text.
 *
 * Separate from `ChatError` on purpose: none of these are provider conditions,
 * and an unsupported upload must never be reported as a chat failure.
 */
export class SourceIngestError extends Error {
  readonly code: SourceIngestErrorCode;
  readonly mediaType: string | undefined;

  constructor(
    code: SourceIngestErrorCode,
    message: string,
    options: SourceIngestErrorOptions = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "SourceIngestError";
    this.code = code;
    this.mediaType = options.mediaType;
  }
}

export function isSourceIngestError(value: unknown): value is SourceIngestError {
  return value instanceof SourceIngestError;
}
