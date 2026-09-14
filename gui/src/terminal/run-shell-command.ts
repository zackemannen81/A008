import { ShellCommandError, parseShellHostResult, type ShellHostResult } from '../../../packages/protocol/src/index.js';
export { ShellCommandError, type ShellHostResult } from '../../../packages/protocol/src/index.js';
import { engineHeaders } from "../session/engine-access.js";
/** Host protocol v1 shell endpoint (ADR 0019 D4). */
export const SHELL_ENDPOINT = "/v1/shell";

export interface RunShellCommandOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly endpoint?: string;
}

/**
 * POST `{ command }` to `/v1/shell` on the A008 GUI host.
 * Does not evaluate or spawn the command in the browser.
 */
export async function executeShellCommand(
  command: string,
  options: RunShellCommandOptions = {},
): Promise<ShellHostResult> {
  const normalized = command.trim();
  if (normalized.length === 0) {
    throw new ShellCommandError("Terminal command must not be empty.");
  }

  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new ShellCommandError("fetch is not available to reach the GUI host shell.");
  }

  const endpoint = options.endpoint ?? SHELL_ENDPOINT;
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        ...engineHeaders(),
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ command: normalized }),
    });
  } catch (cause) {
    throw new ShellCommandError("Failed to reach the A008 GUI host shell.", {
      cause,
    });
  }

  if (!response.ok) {
    throw new ShellCommandError(await failureMessage(response));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new ShellCommandError("GUI host shell returned non-JSON.", { cause });
  }

  return parseShellHostResult(payload);
}

/**
 * Composer-facing API. Returns a formatted host result string.
 * Keep this signature: `runShellCommand(command)`.
 */
export async function runShellCommand(
  command: string,
  options: RunShellCommandOptions = {},
): Promise<string> {
  const result = await executeShellCommand(command, options);
  return formatShellHostResult(result);
}

export function formatShellHostResult(result: ShellHostResult): string {
  const lines = [
    `exit: ${result.exitCode ?? "null"}${result.timedOut ? " (timed out)" : ""}`,
  ];
  if (result.truncated) {
    lines.push("output truncated");
  }
  if (result.stdout.length > 0) {
    lines.push(
      "stdout:",
      result.stdout.endsWith("\n") ? result.stdout.slice(0, -1) : result.stdout,
    );
  }
  if (result.stderr.length > 0) {
    lines.push(
      "stderr:",
      result.stderr.endsWith("\n") ? result.stderr.slice(0, -1) : result.stderr,
    );
  }
  if (result.stdout.length === 0 && result.stderr.length === 0) {
    lines.push("(no output)");
  }
  return `${lines.join("\n")}\n`;
}

async function failureMessage(response: Response): Promise<string> {
  const prefix = `GUI host shell failed (${response.status})`;
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && typeof payload.message === "string") {
      const message = payload.message.trim();
      if (message.length > 0) {
        return `${prefix}: ${message}`;
      }
    }
  } catch {
    // Host may return an empty or non-JSON error body.
  }
  const statusText = response.statusText.trim();
  return statusText.length > 0 ? `${prefix}: ${statusText}` : `${prefix}.`;
}


function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
