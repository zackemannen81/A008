import { spawn } from "node:child_process";
import { ChatError } from "../core/errors.js";

export const DEFAULT_TERMINAL_TIMEOUT_MS = 60_000;
export const DEFAULT_TERMINAL_MAX_BYTES = 64 * 1024;

export interface TerminalRunInput {
  readonly command: string;
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly env?: NodeJS.ProcessEnv;
}

export interface TerminalRunResult {
  readonly command: string;
  readonly cwd: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly truncated: boolean;
}

export type TerminalRunner = (
  input: TerminalRunInput,
) => Promise<TerminalRunResult>;

function nonEmptyCommand(command: string): string {
  const normalized = command.trim();
  if (normalized.length === 0) {
    throw new ChatError("configuration", "Terminal command must not be empty.");
  }
  return normalized;
}

function appendCapped(
  current: string,
  chunk: string,
  maxBytes: number,
): { readonly text: string; readonly truncated: boolean } {
  const remaining = maxBytes - Buffer.byteLength(current, "utf8");
  if (remaining <= 0) {
    return { text: current, truncated: true };
  }
  const bytes = Buffer.from(chunk, "utf8");
  if (bytes.length <= remaining) {
    return { text: current + chunk, truncated: false };
  }
  return {
    text: current + bytes.subarray(0, remaining).toString("utf8"),
    truncated: true,
  };
}

export async function runTerminalCommand(
  input: TerminalRunInput,
): Promise<TerminalRunResult> {
  const command = nonEmptyCommand(input.command);
  const cwd = input.cwd.trim();
  if (cwd.length === 0) {
    throw new ChatError("configuration", "Terminal cwd must not be empty.");
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_TERMINAL_TIMEOUT_MS;
  const maxBytes = input.maxBytes ?? DEFAULT_TERMINAL_MAX_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
    throw new ChatError(
      "configuration",
      "Terminal timeout must be a positive safe integer.",
    );
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new ChatError(
      "configuration",
      "Terminal maxBytes must be a positive safe integer.",
    );
  }

  return await new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      env: input.env ?? process.env,
      shell: true,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const finish = (result: TerminalRunResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      const next = appendCapped(stdout, chunk, maxBytes);
      stdout = next.text;
      truncated = truncated || next.truncated;
    });
    child.stderr?.on("data", (chunk: string) => {
      const next = appendCapped(stderr, chunk, maxBytes);
      stderr = next.text;
      truncated = truncated || next.truncated;
    });
    child.on("error", (cause) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(
        new ChatError("provider", "Terminal process failed to start.", {
          cause,
        }),
      );
    });
    child.on("close", (exitCode, signal) => {
      finish({
        command,
        cwd,
        exitCode,
        signal,
        stdout,
        stderr,
        timedOut,
        truncated,
      });
    });
  });
}

export function formatTerminalResult(result: TerminalRunResult): string {
  const lines = [
    `cwd: ${result.cwd}`,
    `exit: ${result.exitCode ?? "null"}${result.timedOut ? " (timed out)" : ""}`,
  ];
  if (result.signal !== null) {
    lines.push(`signal: ${result.signal}`);
  }
  if (result.truncated) {
    lines.push("output truncated");
  }
  if (result.stdout.length > 0) {
    lines.push("stdout:", result.stdout.endsWith("\n") ? result.stdout.slice(0, -1) : result.stdout);
  }
  if (result.stderr.length > 0) {
    lines.push("stderr:", result.stderr.endsWith("\n") ? result.stderr.slice(0, -1) : result.stderr);
  }
  if (result.stdout.length === 0 && result.stderr.length === 0) {
    lines.push("(no output)");
  }
  return `${lines.join("\n")}\n`;
}
