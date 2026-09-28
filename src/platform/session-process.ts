import { fork, execFileSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { SessionIpc } from "./session-ipc.js";
import type { GuiRunActivity } from "./gui-run-session.js";
import type {
  PlatformTextHistoryMessage,
  PlatformTextTurnResult,
} from "./runtime-adapter.js";
import type { LocalMemoryRuntime } from "../runtime/local-memory-runtime.js";
import type { MemoryReadRequest } from "../memory/retrieval-types.js";
import type { StagePostOutputKnowledgeInput } from "../orchestration/post-output-knowledge-intake.js";
import { parseRuntimeId } from "../identity/runtime-id.js";
import { killProcessTree } from "../tools/terminal.js";
import type { PromptImageAttachment, SessionParameters } from "../../packages/protocol/src/index.js";

export interface SessionProcessIdentity {
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly instanceId: string;
  readonly processId: number;
  readonly state: "running" | "stopped";
}
export interface SessionProcessStart {
  sessionId: string;
  workspaceId: string;
  cwd: string;
  projectRoot: string;
  projectId: string;
  env: NodeJS.ProcessEnv;
  runtime: LocalMemoryRuntime;
  onIdentity: (identity: SessionProcessIdentity) => void;
}
export interface SessionProcessRun {
  runId: string;
  model: string;
  parameters: SessionParameters;
  history: readonly PlatformTextHistoryMessage[];
  text: string;
  attachment?: PromptImageAttachment;
  tools: boolean;
  recoveryRequired?: boolean;
}

/** Owned by the exclusive local host, never by an observer or GUI window. */
export class SessionProcess {
  readonly #child: ChildProcess;
  readonly #rpc: SessionIpc;
  readonly #ready: Promise<unknown>;
  readonly #exited: Promise<void>;
  readonly instanceId = randomUUID();
  #alive = true;
  #busy = false;
  #activity: GuiRunActivity = { thought: "", answer: "", tools: [] };
  #onActivity: ((activity: GuiRunActivity) => void) | undefined;
  #model: string | undefined;
  #runId: string | undefined;

  constructor(readonly input: SessionProcessStart) {
    this.#child = fork(
      fileURLToPath(new URL("./session-worker.js", import.meta.url)),
      [],
      {
        cwd: input.cwd,
        env: {
          ...process.env,
          ...input.env,
          A008_SESSION_INSTANCE: this.instanceId,
        },
        ...{ windowsHide: true },
        detached: process.platform !== "win32",
        serialization: "advanced",
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    this.#child.stderr?.resume();
    this.#exited = new Promise((resolve) =>
      this.#child.once("close", () => resolve()),
    );
    this.#rpc = new SessionIpc(
      {
        send: (value) => this.#child.send(value as object),
        on: (_event, listener) => this.#child.on("message", listener),
      },
      this.instanceId,
      async (method, payload, signal) => {
        if (!this.#alive) throw new Error("Stale session instance.");
        const envelope = payload as { runId?: string; value?: unknown };
        if (!this.#busy || envelope.runId !== this.#runId)
          throw new Error("Stale session run.");
        payload = envelope.value;
        if (method === "activity") {
          if (!this.#busy) return;
          this.#activity = payload as GuiRunActivity;
          this.#onActivity?.(this.activity());
          return;
        }
        if (!this.#busy || !this.#model)
          throw new Error("Memory requires an active session run.");
        if (method === "memory.capabilities")
          return input.runtime.sharedMemoryCapabilities();
        if (method === "memory.inspect")
          return input.runtime.inspectMemory(
            payload as Parameters<LocalMemoryRuntime["inspectMemory"]>[0],
          );
        if (method === "memory.recall")
          return input.runtime.recallSharedMemory(
            payload as Parameters<LocalMemoryRuntime["recallSharedMemory"]>[0],
          );
        if (method === "memory.write")
          return input.runtime.writeSharedMemory(
            payload as Parameters<LocalMemoryRuntime["writeSharedMemory"]>[0],
          );
        if (method === "memory.ingest")
          return input.runtime.ingestSource(
            payload as Parameters<LocalMemoryRuntime["ingestSource"]>[0],
          );
        if (method === "memory.read") {
          const request = payload as MemoryReadRequest;
          if (request.projectId !== input.projectId)
            throw new Error("Memory project mismatch.");
          if (request.conversationId !== input.sessionId)
            throw new Error("Memory session mismatch.");
          return input.runtime.readMemory(request, { signal });
        }
        if (method === "memory.process") {
          const request = payload as {
            conversationId: string;
            input: StagePostOutputKnowledgeInput;
          };
          const id = parseRuntimeId(request.conversationId, "conversation");
          if (id !== input.sessionId)
            throw new Error("Memory session mismatch.");
          const revision = execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: input.cwd,
            encoding: "utf8",
            windowsHide: true,
          }).trim();
          return input.runtime
            .memoryCoordinator(id, this.#model, {
              workspaceId: input.workspaceId,
              revision: `${revision} (working tree observation)`,
            })
            .process(request.input, { signal });
        }
        throw new Error("Unsupported session IPC operation.");
      },
    );
    const exited = () => {
      if (!this.#alive) return;
      this.#alive = false;
      this.#rpc.close();
      input.onIdentity(this.identity());
    };
    this.#child.on("exit", exited);
    this.#child.on("error", exited);
    this.#child.on("disconnect", exited);
    this.#ready = this.#rpc
      .request<{ processId: number }>(
        "initialize",
        {
          sessionId: input.sessionId,
          workspaceId: input.workspaceId,
          cwd: input.cwd,
          projectRoot: input.projectRoot,
          projectId: input.projectId,
        },
        AbortSignal.timeout(15000),
      )
      .then((result) => {
        if (result.processId !== this.#child.pid)
          throw new Error("Session handshake identity mismatch.");
        input.onIdentity(this.identity());
      });
    void this.#ready.catch(() => this.stop());
  }
  get alive(): boolean {
    return this.#alive && this.#child.connected && !this.#child.killed;
  }
  identity(): SessionProcessIdentity {
    return {
      sessionId: this.input.sessionId,
      workspaceId: this.input.workspaceId,
      instanceId: this.instanceId,
      processId: this.#child.pid ?? 0,
      state: this.alive ? "running" : "stopped",
    };
  }
  activity(): GuiRunActivity {
    return this.#activity;
  }
  permission(id: string, allow: boolean): boolean {
    if (!this.alive || this.#activity.permission?.id !== id) return false;
    const { permission: _permission, ...activity } = this.#activity;
    this.#activity = activity;
    this.#onActivity?.(this.activity());
    void this.#rpc
      .request("permission", { runId: this.#runId, id, allow })
      .catch(() => {});
    return true;
  }
  async complete(
    run: SessionProcessRun,
    signal: AbortSignal,
    onActivity: (activity: GuiRunActivity) => void,
  ): Promise<PlatformTextTurnResult> {
    if (this.#busy) throw new Error("Session already has an active run.");
    this.#busy = true;
    this.#runId = run.runId;
    this.#model = run.model;
    this.#onActivity = onActivity;
    this.#activity = { thought: "", answer: "", tools: [] };
    try {
      await this.#ready;
      signal.throwIfAborted();
      return await this.#rpc.request<PlatformTextTurnResult>(
        "run",
        run,
        signal,
      );
    } catch (error) {
      if (signal.aborted) await this.stop();
      throw error;
    } finally {
      this.#busy = false;
      this.#runId = undefined;
      this.#onActivity = undefined;
    }
  }
  async stop(): Promise<void> {
    if (!this.#alive) return this.#exited;
    this.#rpc.close();
    killProcessTree(this.#child.pid);
    this.#alive = false;
    this.input.onIdentity(this.identity());
    await this.#exited;
  }
}
