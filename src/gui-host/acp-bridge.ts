import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import * as acp from "@agentclientprotocol/sdk";

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
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    options.stderr?.write(chunk);
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
    await closed.catch(() => undefined);
    throw error;
  }

  return {
    async newSession(model) {
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
