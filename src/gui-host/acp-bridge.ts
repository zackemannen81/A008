import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import * as acp from "@agentclientprotocol/sdk";
import { ChatError } from "../core/errors.js";

export interface AcpPromptHandlers {
  readonly onThought: (text: string) => void;
  readonly onAnswer: (text: string) => void;
}

export interface AcpBridge {
  newSession(model?: string): Promise<{ sessionId: string }>;
  prompt(
    sessionId: string,
    text: string,
    handlers: AcpPromptHandlers,
    signal: AbortSignal,
  ): Promise<void>;
  cancel(sessionId: string): void;
  close(): Promise<void>;
}

export interface SpawnedAcpBridgeOptions {
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
  readonly stderr?: NodeJS.WritableStream;
  readonly agentPath?: string;
}

export function defaultAcpAgentPath(): string {
  return fileURLToPath(new URL("../acp/server.js", import.meta.url));
}

export async function createSpawnedAcpBridge(
  options: SpawnedAcpBridgeOptions,
): Promise<AcpBridge> {
  const agentPath = options.agentPath ?? defaultAcpAgentPath();
  const child = spawn(process.execPath, [agentPath], {
    cwd: options.cwd,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams;
  const stderrTail = new StderrTail();
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    options.stderr?.write(chunk);
    stderrTail.push(chunk);
  });

  const handlers = new Map<string, AcpPromptHandlers>();
  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
  );
  const connection = acp
    .client({ name: "A008-gui-host" })
    .onNotification("session/update", (context) => {
      const current = handlers.get(context.params.sessionId);
      if (current === undefined) {
        return;
      }
      const thought = textFromUpdate(
        context.params.update,
        "agent_thought_chunk",
      );
      if (thought !== undefined) {
        current.onThought(thought);
      }
      const answer = textFromUpdate(
        context.params.update,
        "agent_message_chunk",
      );
      if (answer !== undefined) {
        current.onAnswer(answer);
      }
    })
    .connect(stream);

  const closed = new Promise<void>((resolve) => {
    child.once("exit", () => {
      resolve();
    });
  });

  try {
    await connection.agent.request("initialize", {
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: { session: { configOptions: {} } },
    });
  } catch (error) {
    connection.close();
    child.kill();
    // The agent usually writes why it refused to start (a missing
    // NVIDIA_API_KEY, for one) just before it exits, so let it flush.
    await Promise.race([closed, delay(250)]);
    throw acpFailure(error, stderrTail.lastLine());
  }

  return {
    async newSession(model) {
      try {
        const created = await connection.agent.request("session/new", {
          cwd: options.cwd,
          mcpServers: [],
        });
        if (model !== undefined) {
          await connection.agent.request("session/set_config_option", {
            sessionId: created.sessionId,
            configId: "model",
            value: model,
          });
        }
        return { sessionId: created.sessionId };
      } catch (error) {
        throw acpFailure(error, stderrTail.lastLine());
      }
    },
    async prompt(sessionId, text, promptHandlers, signal) {
      const cancel = (): void => {
        connection.agent.notify("session/cancel", { sessionId }).catch(() => {
          return undefined;
        });
      };
      if (signal.aborted) {
        cancel();
        return;
      }
      signal.addEventListener("abort", cancel, { once: true });
      handlers.set(sessionId, promptHandlers);
      try {
        await connection.agent.request("session/prompt", {
          sessionId,
          prompt: [{ type: "text", text }],
        });
      } catch (error) {
        throw acpFailure(error, stderrTail.lastLine());
      } finally {
        signal.removeEventListener("abort", cancel);
        handlers.delete(sessionId);
      }
    },
    cancel(sessionId) {
      connection.agent.notify("session/cancel", { sessionId }).catch(() => {
        return undefined;
      });
    },
    async close() {
      connection.close();
      if (child.exitCode === null && child.signalCode === null) {
        child.stdin.end();
        child.kill();
        await Promise.race([closed, once(child, "exit")]);
      }
    },
  };
}

const MAX_STDERR_DETAIL = 300;

/** Last few stderr chunks from the ACP subprocess, kept for failure text. */
class StderrTail {
  #buffer = "";

  push(chunk: string): void {
    this.#buffer = (this.#buffer + chunk).slice(-4_096);
  }

  lastLine(): string | undefined {
    const line = this.#buffer
      .split(/\r?\n/u)
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .at(-1);
    if (line === undefined) {
      return undefined;
    }
    return line.length > MAX_STDERR_DETAIL
      ? `${line.slice(0, MAX_STDERR_DETAIL)}...`
      : line;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The ACP SDK turns an unhandled agent-side error into a generic JSON-RPC
 * `Internal error` and moves the original text to `data.details`. Recover that
 * text, and fall back to what the subprocess said on stderr, so the GUI can
 * show why a turn failed instead of a bare "Internal error" or "ACP connection
 * closed". The result still passes through wire redaction before it is sent.
 */
export function acpFailure(error: unknown, detail?: string): ChatError {
  const message = acpFailureMessage(error);
  const trimmed = detail?.trim();
  const combined =
    trimmed === undefined || trimmed.length === 0 || message.includes(trimmed)
      ? message
      : `${message}: ${trimmed}`;
  return new ChatError("provider", combined, { cause: error });
}

function acpFailureMessage(error: unknown): string {
  if (isRecord(error) && isRecord(error.data)) {
    const details = error.data.details;
    if (typeof details === "string" && details.trim().length > 0) {
      return details;
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "A008-acp request failed.";
}

function textFromUpdate(
  update: acp.SessionUpdate,
  kind: "agent_thought_chunk" | "agent_message_chunk",
): string | undefined {
  if (update.sessionUpdate !== kind) {
    return undefined;
  }
  if (!("content" in update)) {
    return undefined;
  }
  const content = update.content;
  if (content.type !== "text" || typeof content.text !== "string") {
    return undefined;
  }
  return content.text;
}
