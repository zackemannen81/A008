import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  RequestPermissionResponse,
  SessionNotification,
} from "@agentclientprotocol/sdk";
import type {
  RegisteredProject,
  ChatContent,
  SessionControlInput,
  SessionSnapshot,
  V2CommandReceipt,
  V2SessionCommand,
  V2SessionEvent,
  V2SessionServerFrame,
  V2SessionState,
  V2TurnOutcome,
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
import { sameCommittedMessageIdentity } from "../core/chat-content.js";
import type { V2Principal } from "./v2-auth.js";
import { V2AuthError, V2_LIMITS } from "./v2-auth.js";
import {
  V2CommandReceiptStore,
  type V2CommandBegin,
} from "./v2-command-receipts.js";

interface CommittedMessage {
  readonly messageId: string;
  readonly role: "user" | "assistant";
  readonly content: ChatContent;
}
interface ActiveTurn {
  readonly turnId: string;
  readonly settled: Promise<void>;
  readonly resolveSettled: () => void;
  terminal: boolean;
  cancelRequested?: boolean;
  interruptRequested?: boolean;
}
interface SnapshotCapture {
  representedSequence: number;
  readonly queued: V2SessionEvent[];
}
interface OwnedSession {
  readonly sessionId: string;
  readonly projectId: string;
  readonly principalId: string;
  readonly resumeCapability: string;
  connectionId?: string;
  emit?: (frame: V2SessionServerFrame) => void;
  leaseExpiresAt?: number;
  leaseTimer?: ReturnType<typeof setTimeout>;
  active: boolean;
  sequence: number;
  messages: CommittedMessage[];
  activeTurn?: ActiveTurn;
  capture?: SnapshotCapture;
}
interface PendingPermission {
  readonly sessionId: string;
  readonly connectionId: string;
  readonly turnId: string;
  readonly resolve: (response: RequestPermissionResponse) => void;
}

export class V2SessionService {
  readonly #env: NodeJS.ProcessEnv;
  readonly #projectsPath: string;
  readonly #registry: ProjectRuntimeRegistry;
  readonly #serverInstanceId: string;
  readonly #host: EngineHost;
  readonly #now: () => number;
  readonly #resumeLeaseMs: number;
  readonly #sessions = new Map<string, OwnedSession>();
  readonly #permissions = new Map<string, PendingPermission>();
  readonly #receipts: V2CommandReceiptStore;

  constructor(options: {
    env: NodeJS.ProcessEnv;
    projectsPath: string;
    registry: ProjectRuntimeRegistry;
    serverInstanceId: string;
    stderr?: NodeJS.WritableStream;
    now?: () => number;
    resumeLeaseMs?: number;
    commandReceiptLimitPerPrincipal?: number;
  }) {
    this.#env = { ...options.env };
    this.#projectsPath = options.projectsPath;
    this.#registry = options.registry;
    this.#serverInstanceId = options.serverInstanceId;
    this.#now = options.now ?? Date.now;
    this.#resumeLeaseMs =
      options.resumeLeaseMs ?? V2_LIMITS.sessionResumeLeaseMs;
    this.#receipts = new V2CommandReceiptStore({
      serverInstanceId: options.serverInstanceId,
      now: this.#now,
      retentionMs: V2_LIMITS.commandReceiptRetentionMs,
      limitPerPrincipal:
        options.commandReceiptLimitPerPrincipal ??
        V2_LIMITS.commandReceiptLimitPerPrincipal,
    });
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
    if (
      !session ||
      session.principalId !== principal.id ||
      session.projectId !== projectId
    )
      return false;
    if (
      session.connectionId === undefined &&
      session.leaseExpiresAt !== undefined &&
      session.leaseExpiresAt <= this.#now()
    ) {
      void this.#expireDetachedSession(sessionId);
      return false;
    }
    return true;
  }

  beginCommand(
    principal: V2Principal,
    command: V2SessionCommand,
  ): V2CommandBegin {
    return this.#receipts.begin(principal.id, command);
  }

  noteCommandSession(
    principal: V2Principal,
    commandId: string,
    sessionId: string,
  ): V2CommandReceipt {
    return this.#receipts.noteSession(principal.id, commandId, sessionId);
  }

  noteCommandTurn(
    principal: V2Principal,
    commandId: string,
    turnId: string,
  ): V2CommandReceipt {
    return this.#receipts.noteTurn(principal.id, commandId, turnId);
  }

  settleCommandSuccess(
    principal: V2Principal,
    commandId: string,
    details: { sessionId?: string; turnId?: string } = {},
  ): V2CommandReceipt {
    return this.#receipts.succeed(principal.id, commandId, details);
  }

  settleCommandFailure(
    principal: V2Principal,
    commandId: string,
    failure: {
      code: import("../../packages/protocol/src/index.js").V2ErrorCode;
      message: string;
      retryable: boolean;
      sessionId?: string;
      turnId?: string;
    },
  ): V2CommandReceipt {
    return this.#receipts.fail(principal.id, commandId, failure);
  }

  commandReceipt(
    principal: V2Principal,
    projectId: string,
    commandId: string,
  ): V2CommandReceipt {
    return this.#receipts.lookup(principal.id, projectId, commandId);
  }

  resumeCapability(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
  ): string {
    return this.#require(principal, projectId, sessionId, connectionId)
      .resumeCapability;
  }

  async resumeSession(input: {
    principal: V2Principal;
    projectId: string;
    sessionId: string;
    connectionId: string;
    resumeCapability: string;
    emit: (frame: V2SessionServerFrame) => void;
  }): Promise<V2SessionState> {
    const owned = this.#sessions.get(input.sessionId);
    if (
      !owned ||
      owned.projectId !== input.projectId ||
      owned.principalId !== input.principal.id
    )
      throw new V2AuthError(
        "SESSION_EXPIRED",
        404,
        "The project session is unavailable to this principal.",
      );
    if (owned.connectionId !== undefined) {
      if (owned.connectionId !== input.connectionId)
        throw new V2AuthError(
          "SESSION_BUSY",
          409,
          "Session is already attached to another connection.",
        );
      if (owned.capture)
        return this.#state(
          owned,
          this.#host.control(owned.sessionId, { action: "inspect" }),
          owned.capture.representedSequence,
        );
      return this.#captureSnapshot(owned);
    }
    if (
      owned.leaseExpiresAt === undefined ||
      owned.leaseExpiresAt <= this.#now()
    ) {
      await this.#expireDetachedSession(owned.sessionId);
      throw new V2AuthError(
        "SESSION_EXPIRED",
        404,
        "Session resume is unavailable or expired.",
      );
    }
    if (
      !this.#sameResumeCapability(
        owned.resumeCapability,
        input.resumeCapability,
      )
    )
      throw new V2AuthError(
        "SESSION_EXPIRED",
        404,
        "Session resume is unavailable or expired.",
      );

    const previousExpiry = owned.leaseExpiresAt;
    this.#clearLease(owned);
    owned.connectionId = input.connectionId;
    owned.emit = input.emit;
    try {
      return this.#captureSnapshot(owned);
    } catch (error) {
      delete owned.connectionId;
      delete owned.emit;
      owned.leaseExpiresAt = previousExpiry;
      this.#scheduleLeaseExpiry(owned);
      throw error;
    }
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
          if (!owned || !owned.connectionId || !owned.emit)
            return Promise.resolve({ outcome: { outcome: "cancelled" } });
          const connectionId = owned.connectionId;
          const turn = owned.activeTurn;
          if (!turn || turn.terminal)
            return Promise.resolve({ outcome: { outcome: "cancelled" } });
          const permissionId = randomUUID();
          return new Promise<RequestPermissionResponse>((resolve) => {
            this.#permissions.set(permissionId, {
              sessionId: params.sessionId,
              connectionId,
              turnId: turn.turnId,
              resolve,
            });
            this.#emitEvent(owned, {
              event: "tool/permission",
              turnId: turn.turnId,
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
      resumeCapability: randomBytes(32).toString("base64url"),
      connectionId: input.connectionId,
      emit: input.emit,
      active: false,
      sequence: 0,
      messages: [],
    };
    this.#sessions.set(created.sessionId, owned);
    try {
      if (input.model !== undefined)
        this.#host.control(created.sessionId, {
          action: "model",
          model: input.model,
        });
      return this.#state(
        owned,
        this.#host.control(created.sessionId, { action: "inspect" }),
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
    return this.#captureSnapshot(owned);
  }

  finishSnapshot(sessionId: string, connectionId: string): void {
    const owned = this.#sessions.get(sessionId);
    if (!owned || owned.connectionId !== connectionId || !owned.capture) return;
    const queued = owned.capture.queued;
    delete owned.capture;
    for (const event of queued) owned.emit?.(event);
  }

  async prompt(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
    text: string,
    onTurnStarted?: (turnId: string) => void,
  ): Promise<V2SessionState> {
    const owned = this.#require(principal, projectId, sessionId, connectionId);
    if (owned.active)
      throw new V2AuthError(
        "SESSION_BUSY",
        409,
        "Session already has an active turn.",
      );
    let resolveSettled!: () => void;
    const settled = new Promise<void>((resolve) => {
      resolveSettled = resolve;
    });
    const turn: ActiveTurn = {
      turnId: `turn_${randomUUID()}`,
      settled,
      resolveSettled,
      terminal: false,
    };
    owned.active = true;
    owned.activeTurn = turn;
    onTurnStarted?.(turn.turnId);
    this.#emitEvent(owned, { event: "turn/started", turnId: turn.turnId });
    try {
      const result = await this.#host.prompt(
        { sessionId, prompt: [{ type: "text", text }] },
        (message) => this.#notify(message),
      );
      const outcome: V2TurnOutcome =
        result.stopReason === "cancelled"
          ? turn.interruptRequested
            ? "interrupted"
            : "cancelled"
          : "completed";
      const reportedMemoryStatus = result._meta?.["a008.memoryStatus"];
      const memoryStatus =
        typeof reportedMemoryStatus === "string" &&
        reportedMemoryStatus.length > 0
          ? reportedMemoryStatus
          : "unreported";
      this.#settleTurn(owned, turn, outcome, memoryStatus);
    } catch (error) {
      const outcome: V2TurnOutcome = turn.interruptRequested
        ? "interrupted"
        : turn.cancelRequested
          ? "cancelled"
          : "failed";
      this.#settleTurn(owned, turn, outcome);
      throw error;
    } finally {
      owned.active = false;
      this.#denyPermissions(sessionId);
      if (owned.activeTurn === turn) delete owned.activeTurn;
      turn.resolveSettled();
    }
    return this.#state(
      owned,
      this.#host.control(sessionId, { action: "inspect" }),
    );
  }

  cancel(
    principal: V2Principal,
    projectId: string,
    sessionId: string,
    connectionId: string,
  ): V2SessionState {
    const owned = this.#require(principal, projectId, sessionId, connectionId);
    if (owned.activeTurn && !owned.activeTurn.terminal)
      owned.activeTurn.cancelRequested = true;
    this.#denyPermissions(sessionId);
    this.#host.sessionAgent(sessionId).cancel({ sessionId });
    return this.#state(
      owned,
      this.#host.control(sessionId, { action: "inspect" }),
    );
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
      this.#clearLease(owned);
      await this.#host.closeSession(sessionId);
      this.#sessions.delete(sessionId);
      return { ...state, active: false, closed: true };
    }
    const state = this.#host.control(sessionId, control);
    this.#emitEvent(owned, {
      event: "state/changed",
      reason: control.action,
    });
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
    const owned = this.#require(principal, projectId, sessionId, connectionId);
    const pending = this.#permissions.get(permissionId);
    if (
      !pending ||
      pending.sessionId !== sessionId ||
      pending.connectionId !== connectionId ||
      pending.turnId !== owned.activeTurn?.turnId ||
      owned.activeTurn.terminal
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
    return this.#state(
      owned,
      this.#host.control(sessionId, { action: "inspect" }),
    );
  }

  async closeConnection(connectionId: string): Promise<void> {
    const sessions = [...this.#sessions.values()].filter(
      (session) => session.connectionId === connectionId,
    );
    for (const owned of sessions) {
      delete owned.capture;
      const turn = owned.activeTurn;
      if (turn && !turn.terminal) {
        turn.interruptRequested = true;
        this.#denyPermissions(owned.sessionId);
        this.#host.sessionAgent(owned.sessionId).cancel({
          sessionId: owned.sessionId,
        });
        await turn.settled;
      } else {
        this.#denyPermissions(owned.sessionId);
      }
      if (owned.connectionId !== connectionId) continue;
      delete owned.connectionId;
      delete owned.emit;
      owned.leaseExpiresAt = this.#now() + this.#resumeLeaseMs;
      this.#scheduleLeaseExpiry(owned);
    }
  }

  async terminateConnection(connectionId: string): Promise<void> {
    const sessions = [...this.#sessions.values()].filter(
      (session) => session.connectionId === connectionId,
    );
    for (const owned of sessions) await this.#destroySession(owned);
  }

  async close(): Promise<void> {
    for (const permission of this.#permissions.values())
      permission.resolve({ outcome: { outcome: "cancelled" } });
    this.#permissions.clear();
    for (const session of this.#sessions.values()) this.#clearLease(session);
    this.#sessions.clear();
    await this.#host.close();
  }

  #captureSnapshot(owned: OwnedSession): V2SessionState {
    if (owned.capture)
      throw new V2AuthError(
        "SESSION_BUSY",
        409,
        "A session snapshot is already being delivered.",
      );
    owned.capture = { representedSequence: owned.sequence, queued: [] };
    try {
      return this.#state(
        owned,
        this.#host.control(owned.sessionId, { action: "inspect" }),
        owned.capture.representedSequence,
      );
    } catch (error) {
      delete owned.capture;
      throw error;
    }
  }

  #sameResumeCapability(expected: string, received: string): boolean {
    const left = Buffer.from(expected);
    const right = Buffer.from(received);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  #clearLease(owned: OwnedSession): void {
    if (owned.leaseTimer !== undefined) clearTimeout(owned.leaseTimer);
    delete owned.leaseTimer;
    delete owned.leaseExpiresAt;
  }

  #scheduleLeaseExpiry(owned: OwnedSession): void {
    if (owned.leaseExpiresAt === undefined || owned.connectionId !== undefined)
      return;
    if (owned.leaseTimer !== undefined) clearTimeout(owned.leaseTimer);
    const delay = Math.max(0, owned.leaseExpiresAt - this.#now());
    owned.leaseTimer = setTimeout(() => {
      void this.#expireDetachedSession(owned.sessionId).catch(() => undefined);
    }, delay);
    owned.leaseTimer.unref?.();
  }

  async #expireDetachedSession(sessionId: string): Promise<void> {
    const owned = this.#sessions.get(sessionId);
    if (
      !owned ||
      owned.connectionId !== undefined ||
      owned.leaseExpiresAt === undefined
    )
      return;
    if (owned.leaseExpiresAt > this.#now()) {
      this.#scheduleLeaseExpiry(owned);
      return;
    }
    await this.#destroySession(owned);
  }

  async #destroySession(owned: OwnedSession): Promise<void> {
    if (this.#sessions.get(owned.sessionId) !== owned) return;
    this.#clearLease(owned);
    delete owned.capture;
    const turn = owned.activeTurn;
    if (turn && !turn.terminal) {
      turn.interruptRequested = true;
      this.#denyPermissions(owned.sessionId);
      this.#host.sessionAgent(owned.sessionId).cancel({
        sessionId: owned.sessionId,
      });
      await turn.settled;
    } else {
      this.#denyPermissions(owned.sessionId);
    }
    await this.#host.closeSession(owned.sessionId).catch(() => undefined);
    if (this.#sessions.get(owned.sessionId) === owned)
      this.#sessions.delete(owned.sessionId);
    delete owned.connectionId;
    delete owned.emit;
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
        owned.connectionId === undefined
          ? "Session is detached; resume is required."
          : "Session is attached to another connection.",
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

  #state(
    owned: OwnedSession,
    snapshot: SessionSnapshot,
    sequence = owned.sequence,
  ): V2SessionState {
    const messages = this.#reconcileMessages(owned, snapshot.messages);
    return {
      projectId: owned.projectId,
      sessionId: owned.sessionId,
      sequence,
      model: snapshot.model,
      parameters: snapshot.parameters,
      messages,
      active: owned.active,
      ...(owned.activeTurn && !owned.activeTurn.terminal
        ? {
            activeTurn: {
              turnId: owned.activeTurn.turnId,
              status: "running" as const,
            },
          }
        : {}),
      ...(snapshot.runtime.tools ? { tools: snapshot.runtime.tools } : {}),
      ...(snapshot.undone === undefined ? {} : { undone: snapshot.undone }),
      ...(snapshot.closed === undefined ? {} : { closed: snapshot.closed }),
    };
  }

  #reconcileMessages(
    owned: OwnedSession,
    messages: SessionSnapshot["messages"],
  ): readonly CommittedMessage[] {
    let common = 0;
    while (
      common < owned.messages.length &&
      common < messages.length &&
      sameCommittedMessageIdentity(
        owned.messages[common]!,
        messages[common]!,
      )
    )
      common += 1;
    owned.messages = messages.map((message, index) =>
      index < common
        ? { ...owned.messages[index]!, content: message.content }
        : {
            messageId: `message_${randomUUID()}`,
            role: message.role,
            content: message.content,
          },
    );
    return owned.messages;
  }

  async #notify(message: SessionNotification): Promise<void> {
    const owned = this.#sessions.get(message.sessionId);
    if (!owned) return;
    const turn = owned.activeTurn;
    if (!turn || turn.terminal) return;
    const update = message.update;
    if (
      (update.sessionUpdate === "agent_message_chunk" ||
        update.sessionUpdate === "agent_thought_chunk") &&
      update.content.type === "text"
    ) {
      this.#emitEvent(owned, {
        event:
          update.sessionUpdate === "agent_message_chunk"
            ? "answer/delta"
            : "thought/delta",
        turnId: turn.turnId,
        text: update.content.text,
      });
    }
    if (
      update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update"
    ) {
      this.#emitEvent(owned, {
        event: "tool",
        turnId: turn.turnId,
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

  #settleTurn(
    owned: OwnedSession,
    turn: ActiveTurn,
    outcome: V2TurnOutcome,
    memoryStatus: string = "unreported",
  ): void {
    if (turn.terminal) return;
    turn.terminal = true;
    this.#emitEvent(owned, {
      event: "turn/terminal",
      turnId: turn.turnId,
      outcome,
      answerStatus: outcome,
      memoryStatus,
    });
  }

  #emitEvent(
    owned: OwnedSession,
    event:
      | { readonly event: "turn/started"; readonly turnId: string }
      | {
          readonly event: "answer/delta" | "thought/delta";
          readonly turnId: string;
          readonly text: string;
        }
      | {
          readonly event: "tool";
          readonly turnId: string;
          readonly id: string;
          readonly title: string;
          readonly status: string;
          readonly text: string;
        }
      | {
          readonly event: "tool/permission";
          readonly turnId: string;
          readonly permissionId: string;
          readonly title: string;
          readonly text: string;
        }
      | { readonly event: "state/changed"; readonly reason: string }
      | {
          readonly event: "turn/terminal";
          readonly turnId: string;
          readonly outcome: V2TurnOutcome;
          readonly answerStatus: V2TurnOutcome;
          readonly memoryStatus: string;
        },
  ): V2SessionEvent {
    const frame = {
      type: "event" as const,
      serverInstanceId: this.#serverInstanceId,
      sessionId: owned.sessionId,
      sequence: ++owned.sequence,
      ...event,
    } as V2SessionEvent;
    if (owned.capture) owned.capture.queued.push(frame);
    else owned.emit?.(frame);
    return frame;
  }

  #denyPermissions(sessionId: string): void {
    for (const [permissionId, pending] of this.#permissions) {
      if (pending.sessionId !== sessionId) continue;
      this.#permissions.delete(permissionId);
      pending.resolve({ outcome: { outcome: "cancelled" } });
    }
  }
}
