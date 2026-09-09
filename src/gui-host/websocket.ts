import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_PAYLOAD_BYTES = 1024 * 1024;
const OPCODE_CONTINUATION = 0x0;
const OPCODE_TEXT = 0x1;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

export interface GuiWebSocket {
  send(text: string): void;
  /** Send one heartbeat ping; false means the previous ping is still unanswered. */
  ping(): boolean;
  close(code?: number, reason?: string): void;
  readonly closed: Promise<void>;
}

interface ParsedFrame {
  readonly fin: boolean;
  readonly opcode: number;
  readonly payload: Buffer;
  readonly rest: Buffer;
}

export function isWebSocketUpgrade(request: IncomingMessage): boolean {
  const upgrade = headerValue(request.headers.upgrade)?.toLowerCase();
  const connection = headerValue(request.headers.connection);
  if (upgrade !== "websocket" || connection === undefined) {
    return false;
  }
  return connection
    .toLowerCase()
    .split(",")
    .some((part) => part.trim() === "upgrade");
}

export function acceptWebSocket(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  onMessage: (text: string) => void,
): GuiWebSocket | undefined {
  const key = headerValue(request.headers["sec-websocket-key"]);
  const version = headerValue(request.headers["sec-websocket-version"]);
  if (key === undefined || version !== "13") {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    return undefined;
  }
  const accept = createHash("sha1")
    .update(key + WEBSOCKET_GUID)
    .digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  return new OpenGuiWebSocket(socket, head, onMessage);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

class OpenGuiWebSocket implements GuiWebSocket {
  readonly closed: Promise<void>;
  readonly #socket: Duplex;
  readonly #onMessage: (text: string) => void;
  #buffer = Buffer.alloc(0);
  #fragmentOpcode: number | undefined;
  #fragments: Buffer[] = [];
  #closed = false;
  #awaitingPong = false;
  #resolveClosed: () => void = () => undefined;

  constructor(socket: Duplex, head: Buffer, onMessage: (text: string) => void) {
    this.#socket = socket;
    this.#onMessage = onMessage;
    this.closed = new Promise((resolve) => {
      this.#resolveClosed = resolve;
    });
    socket.on("data", (chunk: Buffer) => {
      this.#push(chunk);
    });
    socket.on("close", () => {
      this.#finish();
    });
    socket.on("error", () => {
      this.#finish();
    });
    if (head.length > 0) {
      setImmediate(() => {
        this.#push(head);
      });
    }
  }

  send(text: string): void {
    if (this.#closed) {
      return;
    }
    this.#socket.write(encodeFrame(OPCODE_TEXT, Buffer.from(text, "utf8")));
  }

  ping(): boolean {
    if (this.#closed || this.#awaitingPong) {
      return false;
    }
    this.#awaitingPong = true;
    this.#socket.write(encodeFrame(OPCODE_PING, Buffer.alloc(0)));
    return true;
  }

  close(code = 1000, reason = ""): void {
    if (this.#closed) {
      return;
    }
    this.#socket.write(encodeCloseFrame(code, reason));
    this.#socket.end();
    this.#finish();
  }

  #push(chunk: Buffer): void {
    if (this.#closed) {
      return;
    }
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    try {
      this.#drain();
    } catch {
      this.close(1002, "protocol error");
    }
  }

  #drain(): void {
    while (!this.#closed) {
      const frame = readFrame(this.#buffer);
      if (frame === undefined) {
        return;
      }
      this.#buffer = Buffer.from(frame.rest);
      this.#handleFrame(frame);
    }
  }

  #handleFrame(frame: ParsedFrame): void {
    if (frame.opcode === OPCODE_CLOSE) {
      this.close(1000);
      return;
    }
    if (frame.opcode === OPCODE_PING) {
      this.#socket.write(encodeFrame(OPCODE_PONG, frame.payload));
      return;
    }
    if (frame.opcode === OPCODE_PONG) {
      this.#awaitingPong = false;
      return;
    }
    const isData =
      frame.opcode === OPCODE_TEXT ||
      frame.opcode === OPCODE_CONTINUATION ||
      frame.opcode === 0x2;
    if (!isData) {
      this.close(1002, "unsupported opcode");
      return;
    }
    if (frame.opcode === 0x2) {
      this.close(1003, "binary frames are not supported");
      return;
    }
    if (frame.opcode === OPCODE_TEXT) {
      this.#fragmentOpcode = OPCODE_TEXT;
      this.#fragments = [frame.payload];
    } else if (frame.opcode === OPCODE_CONTINUATION) {
      if (this.#fragmentOpcode !== OPCODE_TEXT) {
        this.close(1002, "unexpected continuation");
        return;
      }
      this.#fragments.push(frame.payload);
    }
    if (!frame.fin) {
      return;
    }
    const payload = Buffer.concat(this.#fragments);
    this.#fragments = [];
    this.#fragmentOpcode = undefined;
    this.#onMessage(payload.toString("utf8"));
  }

  #finish(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#resolveClosed();
  }
}

function readFrame(buffer: Buffer): ParsedFrame | undefined {
  if (buffer.length < 2) {
    return undefined;
  }
  const first = buffer[0];
  const second = buffer[1];
  if (first === undefined || second === undefined) {
    return undefined;
  }
  if ((first & 0x70) !== 0) {
    throw new Error("RSV bits must be zero");
  }
  const fin = (first & 0x80) !== 0;
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  if (!masked) {
    throw new Error("client frames must be masked");
  }
  let payloadLength = second & 0x7f;
  let offset = 2;
  if (payloadLength === 126) {
    if (buffer.length < offset + 2) {
      return undefined;
    }
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) {
      return undefined;
    }
    const length = buffer.readBigUInt64BE(offset);
    if (length > BigInt(MAX_PAYLOAD_BYTES)) {
      throw new Error("payload too large");
    }
    payloadLength = Number(length);
    offset += 8;
  }
  if (payloadLength > MAX_PAYLOAD_BYTES) {
    throw new Error("payload too large");
  }
  if (buffer.length < offset + 4 + payloadLength) {
    return undefined;
  }
  const mask = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
  for (let index = 0; index < payload.length; index += 1) {
    const maskByte = mask[index & 3];
    const payloadByte = payload[index];
    if (maskByte === undefined || payloadByte === undefined) {
      continue;
    }
    payload[index] = payloadByte ^ maskByte;
  }
  return {
    fin,
    opcode,
    payload,
    rest: Buffer.from(buffer.subarray(offset + payloadLength)),
  };
}

function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length;
  let headerLength = 2;
  if (length >= 126 && length <= 0xffff) {
    headerLength += 2;
  } else if (length > 0xffff) {
    headerLength += 8;
  }
  const frame = Buffer.alloc(headerLength + length);
  frame[0] = 0x80 | opcode;
  if (length < 126) {
    frame[1] = length;
    payload.copy(frame, 2);
  } else if (length <= 0xffff) {
    frame[1] = 126;
    frame.writeUInt16BE(length, 2);
    payload.copy(frame, 4);
  } else {
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(length), 2);
    payload.copy(frame, 10);
  }
  return frame;
}

function encodeCloseFrame(code: number, reason: string): Buffer {
  const reasonBytes = Buffer.from(reason, "utf8");
  const payload = Buffer.alloc(2 + reasonBytes.length);
  payload.writeUInt16BE(code, 0);
  reasonBytes.copy(payload, 2);
  return encodeFrame(OPCODE_CLOSE, payload);
}
