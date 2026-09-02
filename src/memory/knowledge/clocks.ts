import { KnowledgeModelError } from "./errors.js";
import type { Instant, Interval } from "./types.js";

export const UNKNOWN_INSTANT: Instant = { unknown: true };

export function isUnknownInstant(
  value: Instant,
): value is { readonly unknown: true } {
  return typeof value === "object" && value.unknown === true;
}

export function serializeInstant(instant: Instant): string {
  if (isUnknownInstant(instant)) {
    return JSON.stringify({ unknown: true });
  }
  return JSON.stringify(instant);
}

export function deserializeInstant(serialized: string): Instant {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (cause) {
    throw new KnowledgeModelError(
      "invalid_input",
      "Instant serialization must be valid JSON.",
      { cause },
    );
  }
  return parsedInstant(parsed);
}

export function serializeInterval(interval: Interval): string {
  return JSON.stringify({
    from: isUnknownInstant(interval.from)
      ? { unknown: true }
      : interval.from,
    to:
      interval.to === null
        ? null
        : isUnknownInstant(interval.to)
          ? { unknown: true }
          : interval.to,
  });
}

export function deserializeInterval(serialized: string): Interval {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (cause) {
    throw new KnowledgeModelError(
      "invalid_input",
      "Interval serialization must be valid JSON.",
      { cause },
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new KnowledgeModelError(
      "invalid_input",
      "Interval must be an object with from and to.",
    );
  }
  const record = parsed as { readonly from?: unknown; readonly to?: unknown };
  if (!("from" in record) || !("to" in record)) {
    throw new KnowledgeModelError(
      "invalid_input",
      "Interval must be an object with from and to.",
    );
  }
  return {
    from: parsedInstant(record.from),
    to: record.to === null ? null : parsedInstant(record.to),
  };
}

function parsedInstant(value: unknown): Instant {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      throw new KnowledgeModelError(
        "invalid_input",
        "Instant string must not be empty.",
      );
    }
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    "unknown" in value &&
    (value as { readonly unknown: unknown }).unknown === true
  ) {
    return UNKNOWN_INSTANT;
  }
  throw new KnowledgeModelError(
    "invalid_input",
    "Instant must be a string or { unknown: true }.",
  );
}
