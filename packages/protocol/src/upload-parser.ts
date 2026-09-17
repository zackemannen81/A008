import type { UploadedSource } from "./http-schemas.js";
export class UploadError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = "UploadError";
  }
}

export function parseUploadedSource(payload: unknown): UploadedSource {
  if (!isRecord(payload)) {
    throw new UploadError("A008 GUI host upload result must be a JSON object.");
  }
  return {
    locator: requiredString(payload.locator, "locator"),
    sha256: requiredString(payload.sha256, "sha256"),
    bytes: requiredNonNegativeInteger(payload.bytes, "bytes"),
    mediaType: requiredString(payload.mediaType, "mediaType"),
    extracted: requiredBoolean(payload.extracted, "extracted"),
    artifactId: optionalString(payload.artifactId, "artifactId"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new UploadError(
      `A008 GUI host upload result field '${field}' must be a non-empty string.`,
    );
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new UploadError(
      `A008 GUI host upload result field '${field}' must be a non-empty string when present.`,
    );
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new UploadError(
      `A008 GUI host upload result field '${field}' must be a boolean.`,
    );
  }
  return value;
}

function requiredNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new UploadError(
      `A008 GUI host upload result field '${field}' must be a non-negative integer.`,
    );
  }
  return value;
}
