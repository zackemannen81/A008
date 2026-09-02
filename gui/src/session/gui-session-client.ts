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
  GuiWebSocket,
  GuiWebSocketConstructor,
  GuiWebSocketEvent,
} from "./types.js";
import { DEFAULT_GUI_MODEL } from "./types.js";

const SOCKET_OPEN = 1;
const SOCKET_CLOSED = 3;

interface PendingRequest {
  readonly requestId: string;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

export interface GuiSessionClient extends GuiSession {
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
  readonly #model: string;
  readonly #webSocket: GuiWebSocketConstructor | undefined;
  readonly #createRequestId: () => string;
  readonly #listeners = new Set<() => void>();

  #snapshot: GuiSessionState;
  #generation = 0;
  #socket: GuiWebSocket | undefined;
  #connectWork: Promise<void> | undefined;
  #pendingConnect: PendingRequest | undefined;
  #pendingPrompt: PendingRequest | undefined;

  constructor(options: GuiSessionClientOptions) {
    this.#url = options.url ?? resolveGuiSessionUrl();
    this.#model = options.model ?? DEFAULT_GUI_MODEL;
    this.#webSocket = options.webSocket;
    this.#createRequestId =
      options.createRequestId ?? (() => globalThis.crypto.randomUUID());
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

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  connect = (): Promise<void> => {
    if (
      this.#snapshot.status === "ready" &&
      this.#snapshot.sessionId !== undefined
    ) {
      return Promise.resolve();
    }
    if (this.#connectWork !== undefined) {
      return this.#connectWork;
    }
    const work = this.#openSession();
    this.#connectWork = work;
    return work.finally(() => {
      if (this.#connectWork === work) {
        this.#connectWork = undefined;
      }
    });
  };

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
    if (this.#pendingPrompt !== undefined) {
      return Promise.reject(new Error("A prompt is already in progress."));
    }

    const requestId = this.#createRequestId();
    const sessionId = this.#snapshot.sessionId;
    this.#replaceSnapshot({
      thought: "",
      answer: "",
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
      this.#replaceSnapshot({ error: failure.message });
      return Promise.reject(failure);
    }

    return done;
  };

  cancel = (): Promise<void> => {
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

    const pending = this.#pendingPrompt;
    if (pending !== undefined) {
      this.#pendingPrompt = undefined;
      pending.reject(new Error("Prompt cancelled."));
    }
    return Promise.resolve();
  };

  /**
   * Opens one socket and asks the host for a session. The `session/new` frame
   * is sent from the socket `open` listener, not after an `await`, so the
   * pending request is always registered before any host frame can arrive.
   */
  #openSession(): Promise<void> {
    this.#generation += 1;
    const generation = this.#generation;
    this.#detachSocket();
    this.#replaceSnapshot({
      status: "connecting",
      sessionId: undefined,
      thought: "",
      answer: "",
      error: undefined,
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
        socket.send(
          encodeClientMessage({
            type: "session/new",
            requestId,
            model: this.#model,
          }),
        );
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
      if (generation !== this.#generation) {
        return;
      }
      this.#fail(generation, "WebSocket connection failed.");
    });
    socket.addEventListener("close", () => {
      if (generation !== this.#generation) {
        return;
      }
      if (
        this.#snapshot.status === "connecting" ||
        this.#pendingConnect !== undefined
      ) {
        this.#fail(generation, "WebSocket closed before the session was ready.");
        return;
      }
      this.#fail(generation, "WebSocket closed.");
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
      case "session/new/ok":
        this.#onSessionOk(message.requestId, message.sessionId);
        return;
      case "thought":
        this.#appendChannel("thought", message.sessionId, message.text);
        return;
      case "answer":
        this.#appendChannel("answer", message.sessionId, message.text);
        return;
      case "prompt/ok":
        this.#onPromptOk(message.requestId, message.sessionId);
        return;
      case "error":
        this.#onHostError(message.requestId, message.message);
        return;
    }
  }

  #onSessionOk(requestId: string, sessionId: string): void {
    const pending = this.#pendingConnect;
    if (pending === undefined || pending.requestId !== requestId) {
      return;
    }
    this.#pendingConnect = undefined;
    this.#replaceSnapshot({
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
    if (this.#snapshot.sessionId !== sessionId) {
      return;
    }
    this.#replaceSnapshot({
      [channel]: this.#snapshot[channel] + text,
    });
  }

  #onPromptOk(requestId: string, sessionId: string): void {
    const pending = this.#pendingPrompt;
    if (
      pending === undefined ||
      pending.requestId !== requestId ||
      this.#snapshot.sessionId !== sessionId
    ) {
      return;
    }
    this.#pendingPrompt = undefined;
    pending.resolve();
  }

  #onHostError(requestId: string | undefined, message: string): void {
    if (
      this.#pendingConnect !== undefined &&
      (requestId === undefined || requestId === this.#pendingConnect.requestId)
    ) {
      const pending = this.#pendingConnect;
      this.#pendingConnect = undefined;
      this.#replaceSnapshot({
        status: "error",
        error: message,
      });
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
        error: message,
      });
      pending.reject(new Error(message));
      return;
    }

    this.#replaceSnapshot({ error: message });
  }

  #fail(generation: number, message: string): void {
    if (generation !== this.#generation) {
      return;
    }
    const connect = this.#pendingConnect;
    const prompt = this.#pendingPrompt;
    this.#pendingConnect = undefined;
    this.#pendingPrompt = undefined;
    if (this.#snapshot.status !== "error") {
      this.#replaceSnapshot({
        status: "error",
        error: message,
      });
    }
    const failure = new Error(message);
    connect?.reject(failure);
    prompt?.reject(failure);
  }

  #detachSocket(): void {
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
