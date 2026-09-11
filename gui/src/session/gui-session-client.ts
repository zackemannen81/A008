import { engineSocketUrl } from "./engine-access.js";
import {
  encodeClientMessage,
  GuiHostProtocolError,
  parseServerMessage,
  resolveGuiSessionUrl,
} from "./protocol.js";
import type {
  GuiSession,
  GuiSessionClientOptions,
  GuiSessionState,
  GuiSessionStatus,
  ToolPermissionDecision,
  GuiWebSocket,
  GuiWebSocketConstructor,
  GuiWebSocketEvent,
} from "./types.js";
import { DEFAULT_GUI_MODEL } from "./types.js";
import type { SessionControl, SessionSnapshot } from "./session-controls.js";

const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;
const DEFAULT_RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 5_000] as const;

interface PendingRequest {
  readonly requestId: string;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

export interface GuiSessionClient extends GuiSession {
  dispose(): void;
  subscribe(listener: () => void): () => void;
  getSnapshot(): GuiSessionState;
}

export function createGuiSessionClient(
  options: GuiSessionClientOptions = {},
): GuiSessionClient {
  return new GuiSessionClientImpl(options);
}

class GuiSessionClientImpl implements GuiSessionClient {
  readonly #url: string;
  #model: string;
  readonly #webSocket: GuiWebSocketConstructor | undefined;
  readonly #createRequestId: () => string;
  readonly #reconnectDelaysMs: readonly number[];
  readonly #listeners = new Set<() => void>();

  #snapshot: GuiSessionState;
  #generation = 0;
  #socket: GuiWebSocket | undefined;
  #connectWork: Promise<void> | undefined;
  #pendingConnect: PendingRequest | undefined;
  #pendingPrompt: PendingRequest | undefined;
  #cancelled = false;
  #observedActive = false;
  #allowAllTools = false;
  #resumeToken: string | undefined;
  #reconnectAttempt = 0;
  #reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  #pendingControl: { requestId: string; control: SessionControl; resolve: (state: SessionSnapshot) => void; reject: (error: Error) => void } | undefined;

  constructor(options: GuiSessionClientOptions) {
    this.#url = engineSocketUrl(options.url ?? resolveGuiSessionUrl());
    this.#model = options.model ?? DEFAULT_GUI_MODEL;
    this.#webSocket = options.webSocket;
    this.#createRequestId =
      options.createRequestId ?? (() => globalThis.crypto.randomUUID());
    this.#reconnectDelaysMs = options.reconnectDelaysMs?.length ? options.reconnectDelaysMs : DEFAULT_RECONNECT_DELAYS_MS;
    this.#snapshot = {
      status: "idle",
      sessionId: undefined,
      model: this.#model,
      thought: "",
      answer: "",
      error: undefined,
    };
  }

  get status(): GuiSessionStatus {
    return this.#snapshot.status;
  }

  get sessionId(): string | undefined {
    return this.#snapshot.sessionId;
  }

  get model(): string {
    return this.#snapshot.model;
  }

  get thought(): string {
    return this.#snapshot.thought;
  }

  get answer(): string {
    return this.#snapshot.answer;
  }

  get error(): string | undefined {
    return this.#snapshot.error;
  }

  getSnapshot = (): GuiSessionState => this.#snapshot;
  resolveToolPermission = (decision: ToolPermissionDecision): void => {
    const permission = this.#snapshot.permission;
    if (!permission) return;
    this.#sendToolPermission(permission.id, decision !== "reject");
    if (decision === "allow_all") this.#allowAllTools = true;
    this.#replaceSnapshot({ permission: undefined });
  };

  dispose = (): void => {
    this.#generation += 1;
    this.#observedActive = false;
    this.#allowAllTools = false;
    this.#resumeToken = undefined;
    this.#clearReconnectTimer();
    this.#detachSocket();
    const error = new Error("Panel disconnected.");
    this.#pendingConnect?.reject(error); this.#pendingPrompt?.reject(error); this.#pendingControl?.reject(error);
    this.#pendingConnect = undefined; this.#pendingPrompt = undefined; this.#pendingControl = undefined; this.#connectWork = undefined;
    this.#replaceSnapshot({ status: "idle", sessionId: undefined, busy: false, tools: [] });
  };

  get details() { return this.#snapshot.details; }
  get busy() { return this.#snapshot.busy ?? false; }
  get pendingText() { return this.#snapshot.pendingText; }

  controlSession = (control: SessionControl): Promise<SessionSnapshot> => {
    const sessionId = this.#snapshot.sessionId;
    if (this.#snapshot.status !== "ready" || sessionId === undefined || this.#socket?.readyState !== SOCKET_OPEN) return Promise.reject(new Error("Connect to a session first."));
    if (this.#pendingControl !== undefined || this.#pendingPrompt !== undefined && control.action !== "close") return Promise.reject(new Error("Wait for the current operation to finish."));
    const requestId = this.#createRequestId();
    const done = new Promise<SessionSnapshot>((resolve, reject) => {
      this.#pendingControl = { requestId, control, resolve, reject };
    });
    this.#replaceSnapshot({ busy: true, error: undefined });
    try { this.#socket.send(encodeClientMessage({ type: "session/control", requestId, sessionId, control })); }
    catch (error) { this.#onHostError(requestId, toError(error, "Session control failed.").message); }
    return done;
  };

  endSession = async (): Promise<void> => {
    if (this.#snapshot.status === "ready" && this.#snapshot.sessionId !== undefined) {
      await this.controlSession({ action: "close" });
    }
    this.#generation += 1;
    this.#allowAllTools = false;
    this.#resumeToken = undefined;
    this.#clearReconnectTimer();
    const failure = new Error("Session ended.");
    this.#pendingConnect?.reject(failure);
    this.#pendingPrompt?.reject(failure);
    this.#pendingControl?.reject(failure);
    this.#pendingConnect = undefined;
    this.#pendingPrompt = undefined;
    this.#pendingControl = undefined;
    this.#connectWork = undefined;
    this.#detachSocket();
    this.#replaceSnapshot({ status: "idle", sessionId: undefined, details: undefined,
      thought: "", answer: "", pendingText: undefined, busy: false, error: undefined });
  };

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  connect = (): Promise<void> => {
    if (this.#snapshot.status === "ready" && this.#snapshot.sessionId !== undefined) {
      return Promise.resolve();
    }
    if (this.#connectWork !== undefined) return this.#connectWork;
    this.#clearReconnectTimer();
    const mode = this.#snapshot.sessionId !== undefined && this.#resumeToken !== undefined ? "resume" : "new";
    return this.#beginConnect(mode);
  };

  #beginConnect(mode: "new" | "resume"): Promise<void> {
    const work = this.#openSession(mode);
    this.#connectWork = work;
    return work.finally(() => {
      if (this.#connectWork === work) this.#connectWork = undefined;
    });
  }

  prompt = (text: string): Promise<void> => {
    if (typeof text !== "string" || text.trim().length === 0) {
      return Promise.reject(new Error("Prompt text is empty."));
    }
    if (
      this.#snapshot.status !== "ready" ||
      this.#snapshot.sessionId === undefined ||
      this.#socket === undefined ||
      this.#socket.readyState !== SOCKET_OPEN
    ) {
      return Promise.reject(new Error("GUI session is not ready."));
    }
    if (this.#pendingPrompt !== undefined || this.#pendingControl !== undefined || this.#observedActive) {
      return Promise.reject(new Error("A prompt is already in progress."));
    }

    const requestId = this.#createRequestId();
    const sessionId = this.#snapshot.sessionId;
    this.#cancelled = false;
    this.#replaceSnapshot({
      busy: true,
      pendingText: text.trim(),
      thought: "",
      answer: "",
      tools: [],
      error: undefined,
    });

    const done = new Promise<void>((resolve, reject) => {
      this.#pendingPrompt = { requestId, resolve, reject };
    });

    try {
      this.#socket.send(
        encodeClientMessage({
          type: "prompt",
          requestId,
          sessionId,
          text,
        }),
      );
    } catch (error) {
      this.#pendingPrompt = undefined;
      const failure = toError(error, "Failed to send prompt.");
      this.#replaceSnapshot({ error: failure.message, busy: false, pendingText: undefined });
      return Promise.reject(failure);
    }

    return done;
  };

  cancel = (): Promise<void> => {
    this.#replaceSnapshot({ permission: undefined });
    if (
      this.#snapshot.sessionId === undefined ||
      this.#socket === undefined ||
      this.#socket.readyState !== SOCKET_OPEN
    ) {
      return Promise.resolve();
    }

    try {
      this.#socket.send(
        encodeClientMessage({
          type: "cancel",
          requestId: this.#createRequestId(),
          sessionId: this.#snapshot.sessionId,
        }),
      );
    } catch (error) {
      return Promise.reject(toError(error, "Failed to send cancel."));
    }

    // Keep the operation busy until ACP acknowledges cancellation, so a reset
    // or a new turn cannot race the still-running core transaction.
    this.#cancelled = this.#pendingPrompt !== undefined;
    return Promise.resolve();
  };

  /**
   * Opens one socket and asks the host for a session. The `session/new` frame
   * is sent from the socket `open` listener, not after an `await`, so the
   * pending request is always registered before any host frame can arrive.
   */
  #openSession(mode: "new" | "resume"): Promise<void> {
    this.#generation += 1;
    const generation = this.#generation;
    this.#allowAllTools = false;
    this.#detachSocket();
    this.#replaceSnapshot({
      status: "connecting",
      pendingText: undefined,
      busy: false,
      error: undefined,
      ...(mode === "new" ? { details: undefined, sessionId: undefined, thought: "", answer: "" } : {}),
    });

    const WebSocketImpl = this.#webSocket ?? globalThis.WebSocket;
    if (typeof WebSocketImpl !== "function") {
      const message = "WebSocket is not available in this environment.";
      this.#fail(generation, message);
      return Promise.reject(new Error(message));
    }

    const requestId = this.#createRequestId();
    const connected = new Promise<void>((resolve, reject) => {
      this.#pendingConnect = { requestId, resolve, reject };
    });

    let socket: GuiWebSocket;
    try {
      socket = new WebSocketImpl(this.#url);
    } catch (error) {
      const failure = toError(error, "GUI session connect failed.");
      this.#fail(generation, failure.message);
      return connected;
    }

    this.#socket = socket;
    this.#listen(socket, generation);

    const requestSession = (): void => {
      if (generation !== this.#generation || this.#socket !== socket) {
        return;
      }
      try {
        const sessionId = this.#snapshot.sessionId;
        const resumeToken = this.#resumeToken;
        socket.send(encodeClientMessage(
          mode === "resume" && sessionId !== undefined && resumeToken !== undefined
            ? { type: "session/resume", requestId, sessionId, resumeToken }
            : { type: "session/new", requestId, model: this.#model },
        ));
      } catch (error) {
        this.#fail(
          generation,
          toError(error, "Failed to open the GUI session.").message,
        );
      }
    };

    if (socket.readyState === SOCKET_OPEN) {
      requestSession();
    } else {
      socket.addEventListener("open", requestSession);
    }

    return connected;
  }

  #listen(socket: GuiWebSocket, generation: number): void {
    socket.addEventListener("message", (event) => {
      this.#onMessage(generation, event);
    });
    socket.addEventListener("error", () => {
      if (generation !== this.#generation) return;
      this.#transportLost(generation, "WebSocket connection failed.");
    });
    socket.addEventListener("close", () => {
      if (generation !== this.#generation) return;
      this.#transportLost(generation, "WebSocket closed.");
    });
  }

  #onMessage(generation: number, event: GuiWebSocketEvent): void {
    if (generation !== this.#generation) {
      return;
    }
    if (this.#snapshot.status === "error") {
      return;
    }
    if (typeof event.data !== "string") {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      this.#fail(generation, "Host sent invalid JSON.");
      return;
    }

    let message;
    try {
      message = parseServerMessage(parsed);
    } catch (error) {
      const failure = toError(error, "Host message is malformed.");
      this.#fail(
        generation,
        failure instanceof GuiHostProtocolError
          ? failure.message
          : "Host message is malformed.",
      );
      return;
    }
    if (message === undefined) {
      return;
    }

    switch (message.type) {
      case "tool/permission":
        if (message.sessionId !== this.#snapshot.sessionId) return;
        if (this.#allowAllTools) {
          this.#sendToolPermission(message.id, true);
          return;
        }
        this.#replaceSnapshot({ permission: { id: message.id, title: message.title, text: message.text } });
        return;
      case "tool": {
        if (message.sessionId !== this.#snapshot.sessionId) return;
        const tools = [...this.#snapshot.tools ?? []];
        const index = tools.findIndex(tool => tool.id === message.id);
        const tool = { id: message.id, title: message.title, status: message.status, text: message.text };
        if (index < 0) tools.push(tool); else tools[index] = tool;
        this.#replaceSnapshot({ tools });
        return;
      }
      case "session/activity": {
        if (message.sessionId !== this.#snapshot.sessionId) return;
        const wasActive = this.#observedActive;
        this.#observedActive = message.active;
        if (!wasActive && message.active) this.#cancelled = false;
        this.#replaceSnapshot({ busy: message.active || this.#pendingPrompt !== undefined || this.#pendingControl !== undefined,
          ...(message.state ? { details: message.state, model: message.state.model } : {}),
          ...(message.active ? { pendingText: message.text, ...(!wasActive ? { thought: "", answer: "", tools: [] } : {}) } : { pendingText: undefined }),
        });
        return;
      }
      case "session/new/ok":
      case "session/resume/ok":
        this.#onSessionOk(message.requestId, message.sessionId, message.resumeToken, message.state);
        return;
      case "session/control/ok": {
        const pending = this.#pendingControl;
        if (pending === undefined || pending.requestId !== message.requestId || message.sessionId !== this.#snapshot.sessionId) return;
        this.#pendingControl = undefined;
        this.#model = message.state.model;
        const clear = pending.control.action !== "inspect" && pending.control.action !== "configure";
        this.#replaceSnapshot({ details: message.state, model: message.state.model, error: undefined,
          busy: this.#pendingPrompt !== undefined, ...(clear ? { thought: "", answer: "", tools: [] } : {}) });
        pending.resolve(message.state);
        return;
      }
      case "thought":
        this.#appendChannel("thought", message.sessionId, message.text);
        return;
      case "answer":
        this.#appendChannel("answer", message.sessionId, message.text);
        return;
      case "prompt/ok":
        this.#onPromptOk(message.requestId, message.sessionId, message.state);
        return;
      case "error":
        this.#onHostError(message.requestId, message.message);
        return;
    }
  }

  #sendToolPermission(permissionId: string, allow: boolean): void {
    const sessionId = this.#snapshot.sessionId;
    if (!sessionId || this.#socket?.readyState !== SOCKET_OPEN) return;
    this.#socket.send(encodeClientMessage({
      type: "tool/permission",
      requestId: this.#createRequestId(),
      sessionId,
      permissionId,
      allow,
    }));
  }

  #onSessionOk(requestId: string, sessionId: string, resumeToken: string | undefined, state?: SessionSnapshot): void {
    const pending = this.#pendingConnect;
    if (pending === undefined || pending.requestId !== requestId) {
      return;
    }
    this.#pendingConnect = undefined;
    this.#resumeToken = resumeToken;
    this.#reconnectAttempt = 0;
    this.#clearReconnectTimer();
    if (state !== undefined) this.#model = state.model;
    this.#replaceSnapshot({
      ...(state === undefined ? {} : { details: state, model: state.model }),
      status: "ready",
      sessionId,
      error: undefined,
    });
    pending.resolve();
  }

  #appendChannel(
    channel: "thought" | "answer",
    sessionId: string,
    text: string,
  ): void {
    if (this.#snapshot.sessionId !== sessionId || this.#pendingPrompt === undefined && !this.#observedActive || this.#cancelled) {
      return;
    }
    this.#replaceSnapshot({
      [channel]: this.#snapshot[channel] + text,
    });
  }

  #onPromptOk(requestId: string, sessionId: string, state?: SessionSnapshot): void {
    this.#replaceSnapshot({ permission: undefined });
    const pending = this.#pendingPrompt;
    if (
      pending === undefined ||
      pending.requestId !== requestId ||
      this.#snapshot.sessionId !== sessionId
    ) {
      return;
    }
    this.#pendingPrompt = undefined;
    this.#replaceSnapshot({ busy: this.#pendingControl !== undefined, pendingText: undefined,
      ...(state === undefined ? {} : { details: state, model: state.model }),
      ...(this.#cancelled ? { thought: "", answer: "" } : {}) });
    if (this.#cancelled) pending.reject(new Error("Prompt cancelled."));
    else pending.resolve();
    this.#cancelled = false;
  }

  #onHostError(requestId: string | undefined, message: string): void {
    this.#replaceSnapshot({ permission: undefined });
    if (this.#pendingControl !== undefined && (requestId === undefined || requestId === this.#pendingControl.requestId)) {
      const pending = this.#pendingControl;
      this.#pendingControl = undefined;
      this.#replaceSnapshot({ busy: this.#pendingPrompt !== undefined, error: message });
      pending.reject(new Error(message));
      return;
    }
    if (
      this.#pendingConnect !== undefined &&
      (requestId === undefined || requestId === this.#pendingConnect.requestId)
    ) {
      const pending = this.#pendingConnect;
      this.#pendingConnect = undefined;
      this.#clearReconnectTimer();
      this.#resumeToken = undefined;
      this.#replaceSnapshot({ status: "error", sessionId: undefined, busy: false, error: message });
      pending.reject(new Error(message));
      return;
    }

    if (
      this.#pendingPrompt !== undefined &&
      (requestId === undefined || requestId === this.#pendingPrompt.requestId)
    ) {
      const pending = this.#pendingPrompt;
      this.#pendingPrompt = undefined;
      this.#replaceSnapshot({
        status: "ready",
        busy: this.#pendingControl !== undefined,
        pendingText: undefined,
        thought: "", answer: "",
        error: message,
      });
      pending.reject(new Error(message));
      return;
    }

    this.#replaceSnapshot({ error: message });
  }

  #transportLost(generation: number, message: string): void {
    if (generation !== this.#generation) return;
    const canResume = this.#snapshot.sessionId !== undefined && this.#resumeToken !== undefined;
    if (!canResume) {
      this.#fail(generation, message);
      return;
    }
    this.#generation += 1;
    this.#allowAllTools = false;
    const failure = new Error("Connection interrupted before the operation completed.");
    this.#pendingConnect?.reject(failure);
    this.#pendingPrompt?.reject(failure);
    this.#pendingControl?.reject(failure);
    this.#pendingConnect = undefined;
    this.#pendingPrompt = undefined;
    this.#pendingControl = undefined;
    this.#connectWork = undefined;
    const socket = this.#socket;
    this.#socket = undefined;
    if (socket !== undefined && socket.readyState !== SOCKET_CLOSED) socket.close();
    this.#replaceSnapshot({ status: "connecting", busy: false, pendingText: undefined, permission: undefined, error: undefined });
    this.#scheduleReconnect();
  }

  #scheduleReconnect(): void {
    if (this.#reconnectTimer !== undefined || this.#snapshot.sessionId === undefined || this.#resumeToken === undefined) return;
    const index = Math.min(this.#reconnectAttempt, this.#reconnectDelaysMs.length - 1);
    const delay = Math.max(0, this.#reconnectDelaysMs[index] ?? 5_000);
    this.#reconnectAttempt += 1;
    this.#reconnectTimer = setTimeout(() => {
      this.#reconnectTimer = undefined;
      void this.#beginConnect("resume").catch(() => undefined);
    }, delay);
  }

  #clearReconnectTimer(): void {
    if (this.#reconnectTimer !== undefined) clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = undefined;
  }

  #fail(generation: number, message: string): void {
    if (generation !== this.#generation) {
      return;
    }
    this.#clearReconnectTimer();
    const connect = this.#pendingConnect;
    const prompt = this.#pendingPrompt;
    const control = this.#pendingControl;
    this.#pendingControl = undefined;
    this.#pendingConnect = undefined;
    this.#pendingPrompt = undefined;
    if (this.#snapshot.status !== "error") {
      this.#replaceSnapshot({
        status: "error",
        busy: false,
        pendingText: undefined,
        error: message,
      });
    }
    const failure = new Error(message);
    connect?.reject(failure);
    prompt?.reject(failure);
    control?.reject(failure);
  }

  #detachSocket(): void {
    this.#observedActive = false;
    this.#replaceSnapshot({ permission: undefined });
    const socket = this.#socket;
    this.#socket = undefined;
    if (socket !== undefined && socket.readyState !== SOCKET_CLOSED) {
      socket.close();
    }
  }

  #replaceSnapshot(patch: Partial<GuiSessionState>): void {
    this.#snapshot = {
      ...this.#snapshot,
      ...patch,
    };
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

function toError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message.length > 0) {
    return error;
  }
  return new Error(fallback);
}
