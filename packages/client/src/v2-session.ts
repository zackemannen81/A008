import {
  isV2SessionEventNewer,
  v2SessionServerFrameSchema,
  type SessionControl,
  type V2SessionCommand,
  type V2SessionEvent,
  type V2SessionState,
} from "@a008/protocol";
import type { CredentialAdapter } from "./credentials.js";
import type { ClientFetch, HttpClientOptions } from "./http.js";
import { resolveV2SessionUrl, V2_SESSION_SUBPROTOCOL } from "./origin.js";
import type { GuiWebSocket, GuiWebSocketConstructor } from "./session-types.js";
import {
  issueV2Ticket,
  lookupV2CommandReceipt,
  V2ClientError,
} from "./v2-http.js";

const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;

export interface V2SessionClientOptions {
  readonly origin: string;
  readonly projectId: string;
  readonly credentials: CredentialAdapter;
  readonly fetch: ClientFetch;
  readonly webSocket: GuiWebSocketConstructor;
  readonly createId?: () => string;
  readonly model?: string;
}

export interface V2SessionView {
  readonly status: "idle" | "connecting" | "ready" | "error";
  readonly serverInstanceId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly state?: V2SessionState | undefined;
  readonly thought: string;
  readonly answer: string;
  readonly error?: string | undefined;
  readonly lastSequence: number;
  readonly uncertainty?: "COMMAND_UNKNOWN" | "SESSION_EXPIRED" | undefined;
  readonly permission?: { id: string; title: string; text: string } | undefined;
}

export interface V2SessionClient {
  connect(): Promise<V2SessionState>;
  resume(): Promise<V2SessionState>;
  inspect(): Promise<V2SessionState>;
  prompt(text: string, commandId?: string): Promise<V2SessionState>;
  cancel(commandId?: string): Promise<V2SessionState>;
  control(control: SessionControl, commandId?: string): Promise<V2SessionState>;
  resolvePermission(permissionId: string, allow: boolean, commandId?: string): Promise<V2SessionState>;
  lookupReceipt(commandId: string): Promise<unknown>;
  getSnapshot(): V2SessionView;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

interface Pending {
  readonly requestId: string;
  readonly resolve: (state: V2SessionState) => void;
  readonly reject: (error: Error) => void;
}

export function createV2SessionClient(
  options: V2SessionClientOptions,
): V2SessionClient {
  return new V2SessionClientImpl(options);
}

class V2SessionClientImpl implements V2SessionClient {
  readonly #options: V2SessionClientOptions;
  readonly #createId: () => string;
  readonly #http: HttpClientOptions;
  readonly #listeners = new Set<() => void>();
  #socket: GuiWebSocket | undefined;
  #resumeCapability: string | undefined;
  #pending = new Map<string, Pending>();
  #sentMutations = new Set<string>();
  #view: V2SessionView = {
    status: "idle",
    thought: "",
    answer: "",
    lastSequence: 0,
  };

  constructor(options: V2SessionClientOptions) {
    this.#options = options;
    this.#createId =
      options.createId ??
      (() => `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
    this.#http = {
      fetch: options.fetch,
      credentials: options.credentials,
      origin: options.origin,
    };
  }

  getSnapshot = (): V2SessionView => this.#view;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  connect = async (): Promise<V2SessionState> => {
    this.#replace({ status: "connecting", error: undefined, uncertainty: undefined });
    const ticket = await issueV2Ticket(this.#http, this.#options.projectId);
    await this.#openSocket(ticket.ticket);
    const opened: V2SessionCommand = this.#options.model
      ? {
          type: "command",
          requestId: this.#createId(),
          commandId: this.#createId(),
          action: "session/new",
          projectId: this.#options.projectId,
          payload: { model: this.#options.model },
        }
      : {
          type: "command",
          requestId: this.#createId(),
          commandId: this.#createId(),
          action: "session/new",
          projectId: this.#options.projectId,
        };
    const state = await this.#command(opened);
    this.#replace({ status: "ready", error: undefined });
    return state;
  };

  resume = async (): Promise<V2SessionState> => {
    const sessionId = this.#view.sessionId;
    const resumeCapability = this.#resumeCapability;
    if (sessionId === undefined || resumeCapability === undefined) {
      throw new V2ClientError("SESSION_EXPIRED", "No resume capability is available.");
    }
    this.#replace({ status: "connecting", error: undefined });
    try {
      const ticket = await issueV2Ticket(
        this.#http,
        this.#options.projectId,
        sessionId,
      );
      await this.#openSocket(ticket.ticket);
      const state = await this.#command({
        type: "command",
        requestId: this.#createId(),
        commandId: this.#createId(),
        action: "session/resume",
        projectId: this.#options.projectId,
        sessionId,
        payload: { resumeCapability },
      });
      this.#replace({ status: "ready", error: undefined, uncertainty: undefined });
      return state;
    } catch (error) {
      if (error instanceof V2ClientError && error.code === "SESSION_EXPIRED") {
        this.#replace({
          status: "error",
          uncertainty: "SESSION_EXPIRED",
          error: error.message,
        });
      }
      throw error;
    }
  };

  inspect = (): Promise<V2SessionState> =>
    this.#command({
      type: "command",
      requestId: this.#createId(),
      action: "session/inspect",
      projectId: this.#options.projectId,
      sessionId: this.#requireSession(),
    });

  prompt = (text: string, commandId?: string): Promise<V2SessionState> => {
    const id = commandId ?? this.#createId();
    this.#guardReplay(id);
    this.#replace({ thought: "", answer: "", error: undefined });
    return this.#command({
      type: "command",
      requestId: this.#createId(),
      commandId: id,
      action: "session/prompt",
      projectId: this.#options.projectId,
      sessionId: this.#requireSession(),
      payload: { text },
    });
  };

  cancel = (commandId?: string): Promise<V2SessionState> => {
    const id = commandId ?? this.#createId();
    this.#guardReplay(id);
    return this.#command({
      type: "command",
      requestId: this.#createId(),
      commandId: id,
      action: "session/cancel",
      projectId: this.#options.projectId,
      sessionId: this.#requireSession(),
    });
  };

  control = (
    control: SessionControl,
    commandId?: string,
  ): Promise<V2SessionState> => {
    const inspect = control.action === "inspect";
    const id = inspect ? undefined : (commandId ?? this.#createId());
    if (id) this.#guardReplay(id);
    return this.#command({
      type: "command",
      requestId: this.#createId(),
      ...(id ? { commandId: id } : {}),
      action: "session/control",
      projectId: this.#options.projectId,
      sessionId: this.#requireSession(),
      payload: { control },
    } as V2SessionCommand);
  };

  resolvePermission = (
    permissionId: string,
    allow: boolean,
    commandId?: string,
  ): Promise<V2SessionState> => {
    const id = commandId ?? this.#createId();
    this.#guardReplay(id);
    return this.#command({
      type: "command",
      requestId: this.#createId(),
      commandId: id,
      action: "tool/permission",
      projectId: this.#options.projectId,
      sessionId: this.#requireSession(),
      payload: { permissionId, allow },
    });
  };

  lookupReceipt = (commandId: string) =>
    lookupV2CommandReceipt(this.#http, this.#options.projectId, commandId);

  dispose = (): void => {
    for (const pending of this.#pending.values())
      pending.reject(new Error("V2 session disconnected."));
    this.#pending.clear();
    this.#detach();
    this.#replace({
      status: "idle",
      sessionId: undefined,
      state: undefined,
      thought: "",
      answer: "",
    });
  };

  #requireSession(): string {
    const sessionId = this.#view.sessionId;
    if (sessionId === undefined)
      throw new V2ClientError("SESSION_EXPIRED", "V2 session is not attached.");
    return sessionId;
  }

  #guardReplay(commandId: string): void {
    if (this.#sentMutations.has(commandId)) {
      throw new V2ClientError(
        "COMMAND_CONFLICT",
        "Refusing to resubmit a mutation the client already sent.",
      );
    }
    if (this.#view.uncertainty === "COMMAND_UNKNOWN") {
      throw new V2ClientError(
        "COMMAND_UNKNOWN",
        "Refusing to resubmit a mutation after unknown outcome.",
      );
    }
    this.#sentMutations.add(commandId);
  }

  async #openSocket(ticket: string): Promise<void> {
    this.#detach();
    const url = this.#options.credentials.applySocketUrl(
      resolveV2SessionUrl(this.#options.origin),
    );
    const socket = new this.#options.webSocket(url, V2_SESSION_SUBPROTOCOL);
    this.#socket = socket;
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => resolve();
      const onError = () => reject(new Error("V2 WebSocket failed to open."));
      socket.addEventListener("open", onOpen);
      socket.addEventListener("error", onError);
      if (socket.readyState === SOCKET_OPEN) resolve();
    });
    socket.addEventListener("message", (event) => this.#onMessage(event.data));
    socket.addEventListener("close", () => {
      if (this.#socket === socket) this.#onClose();
    });
    this.#send({ type: "authenticate", ticket });
    await this.#waitAuthenticated();
  }

  #waitAuthenticated(): Promise<void> {
    return new Promise((resolve, reject) => {
      const requestId = "__authenticate__";
      this.#pending.set(requestId, {
        requestId,
        resolve: () => resolve(),
        reject,
      });
    });
  }

  #command(command: V2SessionCommand): Promise<V2SessionState> {
    if (this.#socket?.readyState !== SOCKET_OPEN)
      return Promise.reject(new Error("V2 session is not connected."));
    const requestId = command.requestId;
    const done = new Promise<V2SessionState>((resolve, reject) => {
      this.#pending.set(requestId, { requestId, resolve, reject });
    });
    this.#send(command);
    return done;
  }

  #send(frame: unknown): void {
    this.#socket?.send(JSON.stringify(frame));
  }

  #onMessage(raw: unknown): void {
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.#replace({ status: "error", error: "Host sent invalid JSON." });
      return;
    }
    const frame = v2SessionServerFrameSchema.safeParse(parsed);
    if (!frame.success) return;
    const message = frame.data;
    if (message.type === "authenticated") {
      this.#replace({
        serverInstanceId: message.serverInstanceId,
        sessionId: message.sessionId ?? this.#view.sessionId,
      });
      const pending = this.#pending.get("__authenticate__");
      if (pending) {
        this.#pending.delete("__authenticate__");
        pending.resolve(this.#view.state ?? emptyState(this.#options.projectId));
      }
      return;
    }
    if (message.type === "error") {
      const error = new V2ClientError(
        message.code,
        message.message,
        message.retryable,
      );
      if (message.code === "COMMAND_UNKNOWN" || message.code === "SESSION_EXPIRED") {
        this.#replace({
          uncertainty: message.code,
          error: message.message,
        });
      }
      const pending =
        (message.requestId ? this.#pending.get(message.requestId) : undefined) ??
        this.#pending.get("__authenticate__");
      if (pending) {
        this.#pending.delete(pending.requestId);
        pending.reject(error);
      }
      return;
    }
    if (message.type === "result") {
      if (message.resumeCapability) this.#resumeCapability = message.resumeCapability;
      if (message.state) this.#applyState(message.state);
      const pending = this.#pending.get(message.requestId);
      if (pending && message.state) {
        this.#pending.delete(message.requestId);
        pending.resolve(message.state);
      }
      return;
    }
    if (message.type === "event") this.#applyEvent(message);
  }

  #applyState(state: V2SessionState): void {
    this.#replace({
      sessionId: state.sessionId,
      state,
      lastSequence: Math.max(this.#view.lastSequence, state.sequence),
    });
  }

  #applyEvent(event: V2SessionEvent): void {
    if (!isV2SessionEventNewer(this.#view.lastSequence, event)) return;
    if (event.event === "thought/delta") {
      this.#replace({
        lastSequence: event.sequence,
        thought: this.#view.thought + event.text,
      });
      return;
    }
    if (event.event === "answer/delta") {
      this.#replace({
        lastSequence: event.sequence,
        answer: this.#view.answer + event.text,
      });
      return;
    }
    if (event.event === "tool/permission") {
      this.#replace({
        lastSequence: event.sequence,
        permission: {
          id: event.permissionId,
          title: event.title,
          text: event.text,
        },
      });
      return;
    }
    this.#replace({ lastSequence: event.sequence });
  }

  #onClose(): void {
    for (const pending of this.#pending.values())
      pending.reject(new Error("V2 WebSocket closed."));
    this.#pending.clear();
    if (this.#view.status === "ready" && this.#resumeCapability) {
      this.#replace({ status: "connecting" });
      return;
    }
    if (this.#view.status !== "idle")
      this.#replace({ status: "error", error: "V2 WebSocket closed." });
  }

  #detach(): void {
    const socket = this.#socket;
    this.#socket = undefined;
    if (socket && socket.readyState !== SOCKET_CLOSED) socket.close();
  }

  #replace(patch: Partial<V2SessionView>): void {
    this.#view = { ...this.#view, ...patch };
    for (const listener of this.#listeners) listener();
  }
}

function emptyState(projectId: string): V2SessionState {
  return {
    projectId,
    sessionId: "pending",
    sequence: 0,
    model: "",
    parameters: {
      stream: true,
      temperature: 1,
      topP: 1,
      maxTokens: 1,
      enableThinking: false,
      reasoningBudget: 0,
      reasoningEffort: null,
      seed: null,
      stop: null,
    },
    messages: [],
    active: false,
  };
}
