import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import * as acp from "@agentclientprotocol/sdk";
import { ChatError } from "../core/errors.js";
import { randomUUID } from "node:crypto";
import type {
  SessionControl,
  SessionSnapshot,
} from "../core/session-control.js";
import type { PromptImageAttachment } from "../../packages/protocol/src/index.js";
import type {
  MemoryInspection,
  MemoryInspectionQuery,
} from "../memory/knowledge/inspection.js";

export interface AcpPromptHandlers {
  readonly onTool?: (
    update: Extract<
      import("./protocol.js").GuiHostServerMessage,
      { type: "tool" }
    >,
  ) => void;
  readonly onPermission?: (
    update: Extract<
      import("./protocol.js").GuiHostServerMessage,
      { type: "tool/permission" }
    >,
  ) => void;
  readonly onThought: (text: string) => void;
  readonly onAnswer: (text: string) => void;
}

/**
 * Params for the ADR 0020 D4 extension method `_a008/source/ingest`. The
 * bridge sends only the locator the host already wrote to disk, the sniffed
 * media type, and the advisory filename — never bytes, per ADR 0020 D1.
 */
export interface AcpSourceIngestInput {
  readonly locator: string;
  readonly mediaType: string;
  readonly filename?: string;
}

/** Result of `_a008/source/ingest`, per ADR 0020 D4. */
export interface AcpSourceIngestResult {
  readonly artifactId: string;
  readonly utteranceIds: readonly string[];
  readonly contentKind?: string;
  readonly relation: string;
  readonly speaker: string;
}

export interface AcpBridge {
  resolveToolPermission?(
    sessionId: string,
    permissionId: string,
    allow: boolean,
  ): void;
  /** Engine panels observe an externally owned session without owning its lifetime. */
  subscribeSession?(
    sessionId: string,
    listener: (message: import("./protocol.js").GuiHostServerMessage) => void,
  ): () => void;
  controlSession?(
    sessionId: string,
    control: SessionControl,
  ): Promise<SessionSnapshot>;
  /** Optional for hosts connected to an older ACP implementation. */
  inspectMemory?(query: MemoryInspectionQuery): Promise<MemoryInspection>;
  newSession(model?: string): Promise<{ sessionId: string }>;
  prompt(
    sessionId: string,
    text: string,
    handlers: AcpPromptHandlers,
    signal: AbortSignal,
    attachment?: PromptImageAttachment,
  ): Promise<void>;
  cancel(sessionId: string): void;
  /**
   * Release one ACP session. The renderer never asks for this; the host calls
   * it when a socket closes so the agent stops holding state for a browser
   * that is gone.
   */
  closeSession(sessionId: string): Promise<void>;
  /**
   * Asks the ACP process to extract and ingest one already-stored source, by
   * locator only (ADR 0020 D1, D4). The agent-side handler is owned by
   * A008-0043 and may not exist on every ACP process this bridge talks to; a
   * caller that gets a rejection should treat the upload as stored but not
   * yet extracted, not as a failed upload.
   */
  ingestSource(input: AcpSourceIngestInput): Promise<AcpSourceIngestResult>;
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
  const permissions = new Map<
    string,
    {
      sessionId: string;
      resolve: (response: acp.RequestPermissionResponse) => void;
    }
  >();
  const cancelPermissions = (sessionId: string) => {
    for (const [id, pending] of permissions)
      if (pending.sessionId === sessionId) {
        permissions.delete(id);
        pending.resolve({ outcome: { outcome: "cancelled" } });
      }
  };
  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
  );
  const connection = acp
    .client({ name: "A008-gui-host" })
    .onRequest("session/request_permission", (context) => {
      const current = handlers.get(context.params.sessionId);
      if (!current?.onPermission)
        return { outcome: { outcome: "cancelled" as const } };
      if (
        !context.params.options.some(
          (option) =>
            option.optionId === "allow-once" && option.kind === "allow_once",
        ) ||
        !context.params.options.some(
          (option) =>
            option.optionId === "reject-once" && option.kind === "reject_once",
        )
      ) {
        return { outcome: { outcome: "cancelled" as const } };
      }
      const id = randomUUID();
      return new Promise<acp.RequestPermissionResponse>((resolve) => {
        permissions.set(id, { sessionId: context.params.sessionId, resolve });
        current.onPermission?.({
          type: "tool/permission",
          sessionId: context.params.sessionId,
          id,
          title: context.params.toolCall.title ?? "Tool execution",
          text: JSON.stringify(context.params.toolCall.rawInput ?? {}, null, 2),
        });
      });
    })
    .onNotification("session/update", (context) => {
      const current = handlers.get(context.params.sessionId);
      if (current === undefined) {
        return;
      }
      const update = context.params.update;
      if (
        update.sessionUpdate === "tool_call" ||
        update.sessionUpdate === "tool_call_update"
      ) {
        current.onTool?.({
          type: "tool",
          sessionId: context.params.sessionId,
          id: update.toolCallId,
          title: update.title ?? "Tool",
          status: update.status ?? "pending",
          text:
            update.content
              ?.flatMap((c) =>
                c.type === "content" && c.content.type === "text"
                  ? [c.content.text]
                  : [],
              )
              .join("\n") ?? "",
        });
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

  let sessionControlSupported = false;
  try {
    const initialized = await connection.agent.request("initialize", {
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: { session: { configOptions: {} } },
    });
    sessionControlSupported =
      initialized.agentCapabilities?._meta?.["a008.sessionControl"] === 1;
  } catch (error) {
    connection.close();
    child.kill();
    // The agent usually writes why it refused to start (a missing
    // NVIDIA_API_KEY, for one) just before it exits, so let it flush.
    await Promise.race([closed, delay(250)]);
    throw acpFailure(error, stderrTail.lastLine());
  }

  return {
    resolveToolPermission(sessionId, permissionId, allow) {
      const pending = permissions.get(permissionId);
      if (!pending || pending.sessionId !== sessionId)
        throw new Error("Permission is no longer pending.");
      permissions.delete(permissionId);
      pending.resolve({
        outcome: {
          outcome: "selected",
          optionId: allow ? "allow-once" : "reject-once",
        },
      });
    },
    ...(sessionControlSupported
      ? {
          async controlSession(sessionId: string, control: SessionControl) {
            try {
              return await connection.agent.request<
                SessionSnapshot,
                SessionControl & { sessionId: string }
              >("_a008/session/control", { sessionId, ...control });
            } catch (error) {
              throw acpFailure(error, stderrTail.lastLine());
            }
          },
        }
      : {}),
    async inspectMemory(query) {
      try {
        return await connection.agent.request<
          MemoryInspection,
          MemoryInspectionQuery
        >("memory/inspect", query);
      } catch (error) {
        throw acpFailure(error, stderrTail.lastLine());
      }
    },
    async newSession(model) {
      let createdId: string | undefined;
      try {
        const created = await connection.agent.request("session/new", {
          cwd: options.cwd,
          mcpServers: [],
        });
        createdId = created.sessionId;
        if (model !== undefined) {
          await connection.agent.request("session/set_config_option", {
            sessionId: created.sessionId,
            configId: "model",
            value: model,
          });
        }
        return { sessionId: created.sessionId };
      } catch (error) {
        if (createdId !== undefined)
          await connection.agent
            .request("session/close", { sessionId: createdId })
            .catch(() => undefined);
        throw acpFailure(error, stderrTail.lastLine());
      }
    },
    async prompt(sessionId, text, promptHandlers, signal, attachment) {
      const cancel = (): void => {
        cancelPermissions(sessionId);
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
          prompt: [
            { type: "text", text },
            ...(attachment === undefined
              ? []
              : [
                  {
                    type: "resource_link" as const,
                    uri: attachment.locator,
                    name: "chat-image",
                    mimeType: attachment.mediaType,
                  },
                ]),
          ],
        });
      } catch (error) {
        throw acpFailure(error, stderrTail.lastLine());
      } finally {
        cancelPermissions(sessionId);
        signal.removeEventListener("abort", cancel);
        handlers.delete(sessionId);
      }
    },
    cancel(sessionId) {
      connection.agent.notify("session/cancel", { sessionId }).catch(() => {
        return undefined;
      });
    },
    async closeSession(sessionId) {
      // Drop the local handler first. Whatever the agent answers, this bridge
      // must not keep a callback for a session the host has given up.
      handlers.delete(sessionId);
      try {
        await connection.agent.request("session/close", { sessionId });
      } catch (error) {
        throw acpFailure(error, stderrTail.lastLine());
      }
    },
    async ingestSource(input) {
      try {
        return await connection.agent.request<
          AcpSourceIngestResult,
          AcpSourceIngestInput
        >("_a008/source/ingest", input);
      } catch (error) {
        throw acpFailure(error, stderrTail.lastLine());
      }
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
    trimmed === undefined ||
    trimmed.length === 0 ||
    message.includes(trimmed) ||
    trimmed.startsWith("memory>")
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
