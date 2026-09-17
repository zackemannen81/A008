export class WireClient {
  readonly frames: any[] = [];
  readonly #queue: any[] = [];
  #waiter: ((value: any) => void) | undefined;
  private constructor(readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data));
      this.frames.push(frame);
      const waiter = this.#waiter;
      this.#waiter = undefined;
      if (waiter) waiter(frame);
      else this.#queue.push(frame);
    });
  }
  static async open(port: number, access?: string) {
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/v1/session${access ? `?access=${access}` : ""}`,
    );
    const client = new WireClient(socket);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return client;
  }
  send(message: unknown) {
    this.socket.send(JSON.stringify(message));
  }
  next(): Promise<any> {
    if (this.#queue.length) return Promise.resolve(this.#queue.shift());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#waiter = undefined;
        reject(new Error("Timed out waiting for frame."));
      }, 10000);
      this.#waiter = (frame) => {
        clearTimeout(timer);
        resolve(frame);
      };
    });
  }
  async until(type: string, requestId?: string) {
    while (true) {
      const frame = await this.next();
      if (
        frame.type === "error" ||
        (frame.type === type &&
          (requestId === undefined || frame.requestId === requestId))
      )
        return frame;
    }
  }
}
