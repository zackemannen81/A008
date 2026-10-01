import type { ShellHostResult } from "../../packages/protocol/src/index.js";
import { spawn } from "node:child_process";
import { ChatError } from "../core/errors.js";

export const DEFAULT_TERMINAL_TIMEOUT_MS = 60_000;
export const DEFAULT_TERMINAL_MAX_BYTES = 64 * 1024;

export interface TerminalRunInput {
  /** Host-selected executable and literal arguments; bypasses the shell. */
  readonly executable?: {
    readonly file: string;
    readonly args: readonly string[];
  };
  readonly command: string;
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly env?: NodeJS.ProcessEnv;
  readonly signal?: AbortSignal;
  readonly shell?: "powershell";
}

export interface TerminalRunResult extends ShellHostResult {
  readonly command: string;
  readonly cwd: string;
  readonly signal: string | null;
  /** True only when the host had to settle after termination without child close. */
  readonly processLost?: boolean;
}

export class TerminalStartError extends Error {}

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
    const powershell =
      input.shell === "powershell" && process.platform === "win32";
    const child = spawn(
      input.executable?.file ?? (powershell ? "powershell.exe" : command),
      input.executable
        ? [...input.executable.args]
        : powershell
          ? [
              "-NoLogo",
              "-NoProfile",
              "-NonInteractive",
              "-EncodedCommand",
              Buffer.from(command, "utf16le").toString("base64"),
            ]
          : [],
      {
        cwd,
        env: input.env ?? process.env,
        shell: !input.executable && !powershell,
        detached: process.platform !== "win32",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let settled = false;
    let observedExitCode: number | null = null;
    let observedSignal: NodeJS.Signals | null = null;
    let closeFallback: ReturnType<typeof setTimeout> | undefined;
    let terminationFallback: ReturnType<typeof setTimeout> | undefined;

    const currentResult = (processLost = false): TerminalRunResult => ({
      command,
      cwd,
      exitCode: observedExitCode,
      signal: observedSignal,
      stdout,
      stderr,
      timedOut,
      truncated,
      ...(processLost ? { processLost: true } : {}),
    });
    const finish = (result: TerminalRunResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (closeFallback) clearTimeout(closeFallback);
      if (terminationFallback) clearTimeout(terminationFallback);
      input.signal?.removeEventListener("abort", cancel);
      if (input.signal?.aborted) {
        reject(new ChatError("cancelled", "Terminal command was cancelled."));
        return;
      }
      resolve(result);
    };
    const terminateAndSettle = (timeout: boolean): void => {
      if (settled) return;
      timedOut = timedOut || timeout;
      killProcessTree(child.pid);
      // Never depend indefinitely on Node's close event after tree termination.
      // The process tree has been asked to stop; a missing close is an
      // observability loss, not permission to leave the tool promise pending.
      terminationFallback = setTimeout(
        () => finish(currentResult(observedExitCode === null)),
        1_000,
      );
    };

    const timer = setTimeout(() => terminateAndSettle(true), timeoutMs);
    const cancel = () => terminateAndSettle(false);
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
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (closeFallback) clearTimeout(closeFallback);
      if (terminationFallback) clearTimeout(terminationFallback);
      input.signal?.removeEventListener("abort", cancel);
      reject(new TerminalStartError("Terminal process failed to start.", { cause }));
    });
    child.on("exit", (exitCode, signal) => {
      observedExitCode = exitCode;
      observedSignal = signal;
      // "close" normally follows after stdout/stderr drain. A descendant can keep
      // an inherited pipe open forever, so settle from the known exit as fallback.
      closeFallback = setTimeout(() => finish(currentResult()), 250);
    });
    child.on("close", (exitCode, signal) => {
      observedExitCode = exitCode;
      observedSignal = signal;
      finish(currentResult());
    });
  });
}

/** Only accepts a child PID created by this host, never a model argument. */
export function killProcessTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.on("error", () => {
      try {
        process.kill(pid);
      } catch {
        /* Already exited. */
      }
    });
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
  }
}

function decodeCliXmlText(value: string): string {
  return value
    .replaceAll("_x000D__x000A_", "\n")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

export function cleanPowerShellStderr(stderr: string): string {
  if (!stderr.startsWith("#< CLIXML")) return stderr;
  const errors = [...stderr.matchAll(/<S S="Error">([\s\S]*?)<\/S>/gu)]
    .map((match) => decodeCliXmlText(match[1] ?? "").trim())
    .filter(Boolean);
  return errors.join("\n");
}

function compactText(value: string, maximum: number): string {
  if (Buffer.byteLength(value, "utf8") <= maximum) return value;
  const lines = value.split(/\r?\n/u);
  const head = lines.slice(0, 12).join("\n");
  const tail = lines.slice(-24).join("\n");
  const joined = `${head}\n… output omitted …\n${tail}`;
  if (Buffer.byteLength(joined, "utf8") <= maximum) return joined;
  return new TextDecoder().decode(
    Buffer.from(joined, "utf8").subarray(0, maximum),
    { stream: true },
  );
}

/** Model-facing terminal feedback: enough to act, never a terminal transcript dump. */
export function terminalFeedback(
  result: TerminalRunResult,
  maximum = 4_096,
): string {
  const stderr = cleanPowerShellStderr(result.stderr);
  const payload = [stderr, result.stdout].filter(Boolean).join("\n").trim();
  const limit = result.exitCode === 0 && !result.timedOut
    ? Math.min(maximum, 2_048)
    : maximum;
  const outcome = result.timedOut
    ? "timeout"
    : result.processLost
      ? "process_lost"
      : result.exitCode === 0
        ? "command_success"
        : "command_nonzero";
  return [
    `outcome: ${outcome}`,
    `exit: ${result.exitCode ?? "null"}`,
    ...(payload ? [compactText(payload, limit)] : []),
  ].join("\n");
}

export function formatTerminalResult(result: TerminalRunResult): string {
  const stderr = cleanPowerShellStderr(result.stderr);
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
    lines.push(
      "stdout:",
      result.stdout.endsWith("\n") ? result.stdout.slice(0, -1) : result.stdout,
    );
  }
  if (stderr.length > 0) {
    lines.push(
      "stderr:",
      stderr.endsWith("\n") ? stderr.slice(0, -1) : stderr,
    );
  }
  if (result.stdout.length === 0 && stderr.length === 0) {
    lines.push("(no output)");
  }
  return `${lines.join("\n")}\n`;
}
