export type KnowledgeModelErrorCode = "invalid_input" | "invalid_proposal";

export interface KnowledgeModelErrorOptions {
  readonly cause?: unknown;
}

export class KnowledgeModelError extends Error {
  readonly code: KnowledgeModelErrorCode;

  constructor(
    code: KnowledgeModelErrorCode,
    message: string,
    options: KnowledgeModelErrorOptions = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "KnowledgeModelError";
    this.code = code;
  }
}

export function isKnowledgeModelError(
  value: unknown,
): value is KnowledgeModelError {
  return value instanceof KnowledgeModelError;
}
