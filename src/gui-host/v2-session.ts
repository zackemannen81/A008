import { randomUUID } from "node:crypto";
import type {
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import type {
  RegisteredProject,
  SessionControlInput,
  SessionSnapshot,
  V2SessionServerFrame,
  V2SessionState,
} from "../../packages/protocol/src/index.js";
import {
  readProjectRegistry,
  findProjectByRoot,
} from "../bootstrap/registry.js";
import { EngineHost } from "../engine/engine-host.js";
import { ProjectRuntimeRegistry } from "../engine/project-runtime-registry.js";
import {
  defaultSqlitePath,
  PROJECT_ID_ENV,
  SQLITE_PATH_ENV,
} from "../runtime/local-runtime-config.js";
import type { V2Principal } from "./v2-auth.js";
import { V2AuthError } from "./v2-auth.js";

interface OwnedSession {
  readonly sessionId: string;
  readonly projectId: string;
  readonly principalId: string;
  readonly connectionId: string;
  readonly emit: (frame: V2SessionServerFrame) => void;
  active: boolean;
}
interface PendingPermission {
  readonly sessionId: string;
  readonly connectionId: string;
  readonly resolve: (response: RequestPermissionResponse) => void;
}

export class V2SessionService {
  readonly #env: NodeJS.ProcessEnv;
  readonly #projectsPath: string;
  readonly #registry: ProjectRuntimeRegistry;
  readonly #host: EngineHost;
  readonly #sessions = new Map<string, OwnedSession>();
  readonly #permissions = new Map<string, PendingPermission>();

  constructor(options: {
    env: NodeJS.ProcessEnv;
    projectsPath: string;
    registry: ProjectRuntimeRegistry;
    stderr?: NodeJS.WritableStream;
  }) {
    this.#env = { ...options.env };
    this.#projectsPath = options.projectsPath;
    this.#registry = options.registry;
    this.#host = new EngineHost({
      env: this.#env,
      registry: this.#registry,
      createPanels: false,
      resolveProject: (cwd) => {
        const project = findProjectByRoot(
          readProjectRegistry(this.#projectsPath),
          cwd,
        );
        if (!project)
          throw new V2AuthError(
            "PROJECT_NOT_FOUND",
            404,
            "Project is not registered.",
          );
        return this.#registry.openConfigured(
          project.rootFolder,
          this.#projectEnv(project),
        );
      },
      ...(options.stderr ? { stderr: options.stderr } : {}),
    });
  }

  sessionAuthorized(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
  ): boolean {
    const session = this.#sessions.get(sessionId);
    return (
      session !== undefined &&
      session.principalId === principal.id &&
      session.projectId === projectId
    );
  }

  async newSession(input: {
    principal: V2Principal;
    projectId: string;
    connectionId: string;
    model?: string;
    emit: (frame: V2SessionServerFrame) => void;
  }): Promise<V2SessionState> {
    const project = this.#project(input.projectId);
    const notify = (message: SessionNotification) => this.#notify(message);
    const created = await this.#host.newSession(
      { cwd: project.rootFolder, mcpServers: [] },
      {
        notify,
        requestPermission: (params) => {
          const owned = this.#sessions.get(params.sessionId);
          if (!owned)
            return Promise.resolve({ outcome: { outcome: "cancelled" } });
          const permissionId = randomUUID();
          return new Promise<RequestPermissionResponse>((resolve) => {
            this.#permissions.set(permissionId, {
              sessionId: params.sessionId,
              connectionId: owned.connectionId,
              resolve,
            });
            owned.emit({
              type: "signal",
              signal: "tool/permission",
              sessionId: params.sessionId,
              permissionId,
              title: params.toolCall.title ?? "Tool execution",
              text: JSON.stringify(params.toolCall.rawInput ?? {}, null, 2),
            });
          });
        },
      },
    );
    const owned: OwnedSession = {
      sessionId: created.sessionId,
      projectId: input.projectId,
      principalId: input.principal.id,
      connectionId: input.connectionId,
      emit: input.emit,
      active: false,
    };
    this.#sessions.set(created.sessionId, owned);
    try {
      if (input.model !== undefined)
        this.#host.control(created.sessionId, {
          action: "model",
          model: input.model,
        });
      return this.inspect(
        input.principal,
        input.projectId,
        created.sessionId,
        input.connectionId,
      );
    } catch (error) {
      this.#sessions.delete(created.sessionId);
      await this.#host.closeSession(created.sessionId).catch(() => undefined);
      throw error;
    }
  }

  inspect(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
  ): V2SessionState {
    const owned = this.#require(principal, projectId, sessionId, connectionId);
    return this.#state(
      owned,
      this.#host.control(sessionId, { action: "inspect" }),
    );
  }
  async prompt(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
    text: string,
  ): Promise<V2SessionState> {
    const owned = this.#require(principal, projectId, sessionId, connectionId);
    if (owned.active)
      throw new V2AuthError(
        "SESSION_BUSY",
        409,
        "Session already has an active turn.",
      );
    owned.active = true;
    try {
      await this.#host.prompt(
        { sessionId, prompt: [{ type: "text", text }] },
        (message) => this.#notify(message),
      );
    } finally {
      owned.active = false;
      this.#denyPermissions(sessionId);
    }
    return this.inspect(principal, projectId, sessionId, connectionId);
  }

  cancel(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
  ): V2SessionState {
    this.#require(principal, projectId, sessionId, connectionId);
    this.#denyPermissions(sessionId);
    this.#host.sessionAgent(sessionId).cancel({ sessionId });
    return this.inspect(principal, projectId, sessionId, connectionId);
  }

  async control(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
    control: SessionControlInput,
  ): Promise<V2SessionState> {
    const owned = this.#require(principal, projectId, sessionId, connectionId);
    if (control.action === "close") {
      const state = this.#state(
        owned,
        this.#host.control(sessionId, { action: "inspect" }),
      );
      this.#denyPermissions(sessionId);
      await this.#host.closeSession(sessionId);
      this.#sessions.delete(sessionId);
      return { ...state, active: false, closed: true };
    }
    const state = this.#host.control(sessionId, control);
    return this.#state(owned, state);
  }

  resolvePermission(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
    permissionId: string,
    allow: boolean,
  ): V2SessionState {
    this.#require(principal, projectId, sessionId, connectionId);
    const pending = this.#permissions.get(permissionId);
    if (
      !pending ||
      pending.sessionId !== sessionId ||
      pending.connectionId !== connectionId
    ) {
      throw new V2AuthError(
        "INVALID_REQUEST",
        400,
        "Tool permission is stale or belongs to another session.",
      );
    }
    this.#permissions.delete(permissionId);
    pending.resolve({
      outcome: {
        outcome: "selected",
        optionId: allow ? "allow-once" : "reject-once",
      },
    });
    return this.inspect(principal, projectId, sessionId, connectionId);
  }

  async closeConnection(connectionId: string): Promise<void> {
    const ids = [...this.#sessions.values()]
      .filter((session) => session.connectionId === connectionId)
      .map((session) => session.sessionId);
    for (const sessionId of ids) {
      this.#denyPermissions(sessionId);
      this.#host.sessionAgent(sessionId).cancel({ sessionId });
      await this.#host.closeSession(sessionId).catch(() => undefined);
      this.#sessions.delete(sessionId);
    }
  }

  async close(): Promise<void> {
    for (const permission of this.#permissions.values())
      permission.resolve({ outcome: { outcome: "cancelled" } });
    this.#permissions.clear();
    this.#sessions.clear();
    await this.#host.close();
  }

  #require(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
  ): OwnedSession {
    const owned = this.#sessions.get(sessionId);
    if (
      !owned ||
      owned.projectId !== projectId ||
      owned.principalId !== principal.id
    ) {
      throw new V2AuthError(
        "SESSION_EXPIRED",
        404,
        "The project session is unavailable to this principal.",
      );
    }
    if (owned.connectionId !== connectionId)
      throw new V2AuthError(
        "SESSION_BUSY",
        409,
        "Session is attached to another connection.",
      );
    return owned;
  }
  #project(projectId: string): RegisteredProject {
    const project = readProjectRegistry(this.#projectsPath).projects.find(
      (entry) => entry.projectId === projectId,
    );
    if (!project)
      throw new V2AuthError(
        "PROJECT_NOT_FOUND",
        404,
        "Project is not registered.",
      );
    return project;
  }

  #projectEnv(project: RegisteredProject): NodeJS.ProcessEnv {
    return {
      ...this.#env,
      [PROJECT_ID_ENV]: project.projectId,
      [SQLITE_PATH_ENV]: project.memory.useGlobalA008Memory
        ? (this.#env[SQLITE_PATH_ENV] ?? defaultSqlitePath())
        : ":memory:",
    };
  }

  #state(owned: OwnedSession, snapshot: SessionSnapshot): V2SessionState {
    return {
      projectId: owned.projectId,
      sessionId: owned.sessionId,
      model: snapshot.model,
      parameters: snapshot.parameters,
      messages: snapshot.messages,
      active: owned.active,
      ...(snapshot.runtime.tools ? { tools: snapshot.runtime.tools } : {}),
      ...(snapshot.undone === undefined ? {} : { undone: snapshot.undone }),
      ...(snapshot.closed === undefined ? {} : { closed: snapshot.closed }),
    };
  }

  async #notify(message: SessionNotification): Promise<void> {
    const owned = this.#sessions.get(message.sessionId);
    if (!owned) return;
    const update = message.update;
    if (
      (update.sessionUpdate === "agent_message_chunk" ||
        update.sessionUpdate === "agent_thought_chunk") &&
      update.content.type === "text"
    ) {
      owned.emit({
        type: "signal",
        signal:
          update.sessionUpdate === "agent_message_chunk" ? "answer" : "thought",
        sessionId: message.sessionId,
        text: update.content.text,
      });
    }
    if (
      update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update"
    ) {
      owned.emit({
        type: "signal",
        signal: "tool",
        sessionId: message.sessionId,
        id: update.toolCallId,
        title: update.title ?? "Tool",
        status: update.status ?? "pending",
        text:
          update.content
            ?.flatMap((item) =>
              item.type === "content" && item.content.type === "text"
                ? [item.content.text]
                : [],
            )
            .join("\n") ?? "",
      });
    }
  }

  #denyPermissions(sessionId: string): void {
    for (const [permissionId, pending] of this.#permissions) {
      if (pending.sessionId !== sessionId) continue;
      this.#permissions.delete(permissionId);
      pending.resolve({ outcome: { outcome: "cancelled" } });
    }
  }
}
