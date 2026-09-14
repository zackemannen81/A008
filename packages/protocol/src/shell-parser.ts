import type { ShellHostResult } from './http-schemas.js';
export class ShellCommandError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = "ShellCommandError";
  }
}

export function parseShellHostResult(payload: unknown): ShellHostResult {
  if (!isRecord(payload)) {
    throw new ShellCommandError("GUI host shell result must be a JSON object.");
  }
  return {
    stdout: requiredString(payload.stdout, "stdout"),
    stderr: requiredString(payload.stderr, "stderr"),
    exitCode: parseExitCode(payload.exitCode),
    timedOut: requiredBoolean(payload.timedOut, "timedOut"),
    truncated: requiredBoolean(payload.truncated, "truncated"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ShellCommandError(
      `GUI host shell result field '${field}' must be a string.`,
    );
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ShellCommandError(
      `GUI host shell result field '${field}' must be a boolean.`,
    );
  }
  return value;
}

function parseExitCode(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  throw new ShellCommandError(
    "GUI host shell result field 'exitCode' must be an integer or null.",
  );
}
