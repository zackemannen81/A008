import { spawn } from "node:child_process";
import { ChatError } from "../core/errors.js";

export const DEFAULT_TERMINAL_TIMEOUT_MS = 60_000;
export const DEFAULT_TERMINAL_MAX_BYTES = 64 * 1024;

export interface TerminalRunInput {
  /** Host-selected executable and literal arguments; bypasses the shell. */
  readonly executable?: { readonly file: string; readonly args: readonly string[] };
  readonly command: string;
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly env?: NodeJS.ProcessEnv;
  readonly signal?: AbortSignal;
  readonly shell?: "powershell";
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
  input.signal?.throwIfAborted();
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
    const powershell = input.shell === "powershell" && process.platform === "win32";
    const child = spawn(input.executable?.file ?? (powershell ? "powershell.exe" : command), input.executable ? [...input.executable.args] : powershell
      ? ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")] : [], {
      cwd,
      env: input.env ?? process.env,
      shell: !input.executable && !powershell,
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
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
      input.signal?.removeEventListener("abort", cancel);
      if (input.signal?.aborted) { reject(new ChatError("cancelled", "Terminal command was cancelled.")); return; }
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
    }, timeoutMs);
    const cancel = () => killProcessTree(child.pid);
    input.signal?.addEventListener("abort", cancel, { once: true });

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
      input.signal?.removeEventListener("abort", cancel);
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

/** Only accepts a child PID created by this host, never a model argument. */
export function killProcessTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    killer.on("error", () => { try { process.kill(pid); } catch { /* Already exited. */ } });
  } else {
    try { process.kill(-pid, "SIGKILL"); } catch { try { process.kill(pid, "SIGKILL"); } catch { /* Already exited. */ } }
  }
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
