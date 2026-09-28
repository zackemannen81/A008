import { randomUUID } from "node:crypto";

/** Private inherited IPC channel; not a network or client command surface. */
export interface IpcChannel {
  send(message: unknown): unknown;
  on(event: "message", listener: (message: unknown) => void): unknown;
}

export class SessionProcessDisconnectedError extends Error {
  readonly code = "SESSION_PROCESS_DISCONNECTED";
  constructor(
    message = "Session process disconnected; execution outcome may be unknown.",
  ) {
    super(message);
    this.name = "SessionProcessDisconnectedError";
  }
}
type Message = { version: 1; instanceId: string; id: string } & (
  | { type: "request"; method: string; payload: unknown }
  | { type: "response"; value?: unknown; error?: string }
  | { type: "cancel" }
);

export class SessionIpc {
  readonly #pending = new Map<
    string,
    { resolve(value: unknown): void; reject(error: Error): void }
  >();
  readonly #active = new Map<string, AbortController>();
  #closed = false;
  constructor(
    readonly channel: IpcChannel,
    readonly instanceId: string,
    readonly handle: (
      method: string,
      payload: unknown,
      signal: AbortSignal,
    ) => Promise<unknown>,
  ) {
    channel.on("message", (value) => {
      void this.#receive(value);
    });
  }
  async request<T>(
    method: string,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    if (this.#closed) throw new Error("Session process is unavailable.");
    signal?.throwIfAborted();
    const id = randomUUID();
    const cancel = () => {
      this.#send({
        version: 1,
        instanceId: this.instanceId,
        id,
        type: "cancel",
      });
      this.#pending.get(id)?.reject(new Error("Session operation cancelled."));
      this.#pending.delete(id);
    };
    try {
      return (await new Promise<unknown>((resolve, reject) => {
        this.#pending.set(id, { resolve, reject });
        signal?.addEventListener("abort", cancel, { once: true });
        this.#send({
          version: 1,
          instanceId: this.instanceId,
          id,
          type: "request",
          method,
          payload,
        });
      })) as T;
    } finally {
      signal?.removeEventListener("abort", cancel);
      this.#pending.delete(id);
    }
  }
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const pending of this.#pending.values())
      pending.reject(new SessionProcessDisconnectedError());
    this.#pending.clear();
    for (const active of this.#active.values()) active.abort();
    this.#active.clear();
  }
  #send(message: Message): void {
    if (this.#closed) return;
    try {
      this.channel.send(message);
    } catch {
      this.close();
    }
  }
  async #receive(value: unknown): Promise<void> {
    if (this.#closed || !value || typeof value !== "object") return;
    const message = value as Message;
    if (
      message.version !== 1 ||
      message.instanceId !== this.instanceId ||
      typeof message.id !== "string"
    )
      return;
    if (message.type === "cancel") {
      this.#active.get(message.id)?.abort();
      return;
    }
    if (message.type === "response") {
      const pending = this.#pending.get(message.id);
      if (message.error) pending?.reject(new Error(message.error));
      else pending?.resolve(message.value);
      this.#pending.delete(message.id);
      return;
    }
    if (
      message.type !== "request" ||
      typeof message.method !== "string" ||
      this.#active.has(message.id)
    )
      return;
    const abort = new AbortController();
    this.#active.set(message.id, abort);
    try {
      const result = await this.handle(
        message.method,
        message.payload,
        abort.signal,
      );
      this.#send({
        version: 1,
        instanceId: this.instanceId,
        id: message.id,
        type: "response",
        value: result,
      });
    } catch (error) {
      this.#send({
        version: 1,
        instanceId: this.instanceId,
        id: message.id,
        type: "response",
        error:
          error instanceof Error
            ? error.message
            : "Session IPC operation failed.",
      });
    } finally {
      this.#active.delete(message.id);
    }
  }
}
