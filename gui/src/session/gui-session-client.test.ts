import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createGuiSessionClient,
  type GuiSessionClient,
} from "./gui-session-client.js";
import {
  CLIENT_MESSAGE_KEYS,
  encodeClientMessage,
  parseServerMessage,
  resolveGuiSessionUrl,
} from "./protocol.js";
import type { GuiWebSocket, GuiWebSocketEvent } from "./types.js";
import { DEFAULT_GUI_MODEL } from "./types.js";
import { settleQuietly } from "./use-gui-session.js";

const ALLOWED_CLIENT_KEYS = new Set<string>(CLIENT_MESSAGE_KEYS);
const SESSION_DIR = dirname(fileURLToPath(import.meta.url));

class FakeWebSocket implements GuiWebSocket {
  readonly url: string;
  readyState = 0;
  readonly sent: string[] = [];
  readonly #listeners = new Map<
    string,
    Set<(event: GuiWebSocketEvent) => void>
  >();

  constructor(url: string) {
    this.url = url;
    fakeSockets.push(this);
  }

  addEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: GuiWebSocketEvent) => void,
  ): void {
    let set = this.#listeners.get(type);
    if (set === undefined) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener);
  }

  removeEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: GuiWebSocketEvent) => void,
  ): void {
    this.#listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    if (this.readyState !== 1) {
      throw new Error("WebSocket is not open");
    }
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === 3) {
      return;
    }
    this.readyState = 3;
    this.#emit("close", {});
  }

  open(): void {
    this.readyState = 1;
    this.#emit("open", {});
  }

  deliver(payload: unknown): void {
    this.#emit("message", { data: JSON.stringify(payload) });
  }

  deliverRaw(data: string): void {
    this.#emit("message", { data });
  }

  fail(): void {
    this.#emit("error", {});
    this.close();
  }

  #emit(type: string, event: GuiWebSocketEvent): void {
    const set = this.#listeners.get(type);
    if (set === undefined) {
      return;
    }
    for (const listener of [...set]) {
      listener(event);
    }
  }
}

const fakeSockets: FakeWebSocket[] = [];

function createClient(
  overrides: {
    url?: string;
    model?: string;
  } = {},
): GuiSessionClient {
  fakeSockets.length = 0;
  let nextId = 0;
  return createGuiSessionClient({
    url: overrides.url ?? "ws://gui.test/v1/session",
    model: overrides.model,
    webSocket: FakeWebSocket,
    createRequestId: () => {
      nextId += 1;
      return `req-${nextId}`;
    },
  });
}

async function becomeReady(
  client: GuiSessionClient,
  sessionId = "sess-1",
): Promise<FakeWebSocket> {
  const pending = client.connect();
  const socket = fakeSockets.at(-1);
  assert.ok(socket);
  socket.open();
  socket.deliver({
    type: "session/new/ok",
    requestId: "req-1",
    sessionId,
  });
  await pending;
  return socket;
}

function parsedFrames(socket: FakeWebSocket): Record<string, unknown>[] {
  return socket.sent.map((frame) => JSON.parse(frame) as Record<string, unknown>);
}

function assertNoSecretFields(socket: FakeWebSocket): void {
  for (const frame of parsedFrames(socket)) {
    for (const key of Object.keys(frame)) {
      assert.ok(
        ALLOWED_CLIENT_KEYS.has(key),
        `unexpected client field: ${key}`,
      );
    }
    assert.equal("authorization" in frame, false);
    assert.equal("apiKey" in frame, false);
    assert.equal("env" in frame, false);
  }
}

test("resolveGuiSessionUrl uses the page host and /v1/session", () => {
  assert.equal(
    resolveGuiSessionUrl({ protocol: "http:", host: "localhost:5173" }),
    "ws://localhost:5173/v1/session",
  );
  assert.equal(
    resolveGuiSessionUrl({ protocol: "https:", host: "a008.example" }),
    "wss://a008.example/v1/session",
  );
  assert.equal(
    resolveGuiSessionUrl(undefined),
    "ws://127.0.0.1:8787/v1/session",
  );
});

test("encodeClientMessage writes only protocol fields", () => {
  const encoded = encodeClientMessage({
    type: "session/new",
    requestId: "req-1",
    model: DEFAULT_GUI_MODEL,
  });
  const body = JSON.parse(encoded) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["model", "requestId", "type"]);
  assert.equal(body.type, "session/new");
});

test("parseServerMessage accepts host protocol v1 frames", () => {
  assert.deepEqual(
    parseServerMessage({
      type: "thought",
      sessionId: "sess-1",
      text: "hmm",
    }),
    { type: "thought", sessionId: "sess-1", text: "hmm" },
  );
  assert.equal(parseServerMessage({ type: "future/event" }), undefined);
});

test("connect opens /v1/session and stores sessionId without secret fields", async () => {
  const client = createClient();
  const pending = client.connect();
  assert.equal(client.status, "connecting");
  const socket = fakeSockets[0];
  assert.ok(socket);
  assert.equal(socket.url, "ws://gui.test/v1/session");
  socket.open();
  assert.deepEqual(parsedFrames(socket), [
    {
      type: "session/new",
      requestId: "req-1",
      model: DEFAULT_GUI_MODEL,
    },
  ]);
  assertNoSecretFields(socket);
  socket.deliver({
    type: "session/new/ok",
    requestId: "req-1",
    sessionId: "sess-1",
  });
  await pending;
  assert.equal(client.status, "ready");
  assert.equal(client.sessionId, "sess-1");
  assert.equal(client.error, undefined);
  await client.connect();
  assert.equal(fakeSockets.length, 1);
});

test("connect is idempotent once ready", async () => {
  const client = createClient();
  await becomeReady(client);
  await client.connect();
  assert.equal(fakeSockets.length, 1);
  assert.equal(client.sessionId, "sess-1");
});

test("prompt streams thought and answer on separate buffers", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const pending = client.prompt("Hello from A008");
  assert.deepEqual(parsedFrames(socket)[1], {
    type: "prompt",
    requestId: "req-2",
    sessionId: "sess-1",
    text: "Hello from A008",
  });
  assertNoSecretFields(socket);

  socket.deliver({ type: "thought", sessionId: "sess-1", text: "think-" });
  socket.deliver({ type: "thought", sessionId: "sess-1", text: "ing" });
  socket.deliver({ type: "answer", sessionId: "sess-1", text: "Hel" });
  socket.deliver({
    type: "thought",
    sessionId: "other",
    text: "should-not-mix",
  });
  socket.deliver({ type: "answer", sessionId: "sess-1", text: "lo" });
  socket.deliver({
    type: "prompt/ok",
    requestId: "req-2",
    sessionId: "sess-1",
  });
  await pending;

  assert.equal(client.thought, "think-ing");
  assert.equal(client.answer, "Hello");
  assert.equal(client.status, "ready");
});

test("a new prompt clears previous thought and answer buffers", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const first = client.prompt("one");
  socket.deliver({ type: "thought", sessionId: "sess-1", text: "old-thought" });
  socket.deliver({ type: "answer", sessionId: "sess-1", text: "old-answer" });
  socket.deliver({
    type: "prompt/ok",
    requestId: "req-2",
    sessionId: "sess-1",
  });
  await first;

  const second = client.prompt("two");
  assert.equal(client.thought, "");
  assert.equal(client.answer, "");
  socket.deliver({ type: "answer", sessionId: "sess-1", text: "fresh" });
  socket.deliver({
    type: "prompt/ok",
    requestId: "req-3",
    sessionId: "sess-1",
  });
  await second;
  assert.equal(client.answer, "fresh");
  assert.equal(client.thought, "");
});

test("overlapping prompt is rejected and does not send a second frame", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const first = client.prompt("one");
  await assert.rejects(client.prompt("two"), /already in progress/);
  assert.equal(socket.sent.length, 2);
  socket.deliver({
    type: "prompt/ok",
    requestId: "req-2",
    sessionId: "sess-1",
  });
  await first;
});

test("prompt before connect is rejected", async () => {
  const client = createClient();
  await assert.rejects(client.prompt("hello"), /not ready/);
  assert.equal(fakeSockets.length, 0);
});

test("cancel sends cancel and rejects the in-flight prompt", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const pending = client.prompt("stop me");
  await client.cancel();
  assert.deepEqual(parsedFrames(socket)[2], {
    type: "cancel",
    requestId: "req-3",
    sessionId: "sess-1",
  });
  assertNoSecretFields(socket);
  await assert.rejects(pending, /cancelled/);
  assert.equal(client.status, "ready");
});

test("host error during connect sets error status", async () => {
  const client = createClient();
  const pending = client.connect();
  const socket = fakeSockets[0];
  assert.ok(socket);
  socket.open();
  socket.deliver({
    type: "error",
    requestId: "req-1",
    message: "session failed",
  });
  await assert.rejects(pending, /session failed/);
  assert.equal(client.status, "error");
  assert.equal(client.error, "session failed");
  assert.equal(client.sessionId, undefined);
});

test("host error during prompt keeps the session ready", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const pending = client.prompt("hello");
  socket.deliver({
    type: "error",
    requestId: "req-2",
    sessionId: "sess-1",
    message: "turn failed",
  });
  await assert.rejects(pending, /turn failed/);
  assert.equal(client.status, "ready");
  assert.equal(client.sessionId, "sess-1");
  assert.equal(client.error, "turn failed");
});

test("malformed JSON fails the session", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  socket.deliverRaw("{not-json");
  assert.equal(client.status, "error");
  assert.match(client.error ?? "", /invalid JSON/);
});

test("unknown host frames are ignored", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  socket.deliver({ type: "metrics", extra: true });
  assert.equal(client.status, "ready");
  assert.equal(client.thought, "");
  assert.equal(client.answer, "");
});

test("WebSocket failure during connect surfaces as error", async () => {
  const client = createClient();
  const pending = client.connect();
  const socket = fakeSockets[0];
  assert.ok(socket);
  socket.fail();
  await assert.rejects(pending);
  assert.equal(client.status, "error");
});

test("connect after error opens a new socket", async () => {
  const client = createClient();
  const first = client.connect();
  fakeSockets[0]?.fail();
  await assert.rejects(first);

  const retry = client.connect();
  assert.equal(client.status, "connecting");
  const socket = fakeSockets.at(-1);
  assert.ok(socket);
  socket.open();
  const request = parsedFrames(socket)[0];
  assert.equal(request?.type, "session/new");
  socket.deliver({
    type: "session/new/ok",
    requestId: request.requestId,
    sessionId: "sess-2",
  });
  await retry;
  assert.equal(client.status, "ready");
  assert.equal(client.sessionId, "sess-2");
});

test("subscribe notifies listeners of snapshot changes", async () => {
  const client = createClient();
  const seen: string[] = [];
  const unsubscribe = client.subscribe(() => {
    seen.push(client.getSnapshot().status);
  });
  const pending = client.connect();
  fakeSockets[0]?.open();
  fakeSockets[0]?.deliver({
    type: "session/new/ok",
    requestId: "req-1",
    sessionId: "sess-1",
  });
  await pending;
  unsubscribe();
  assert.ok(seen.includes("connecting"));
  assert.ok(seen.includes("ready"));
  assert.equal(client.getSnapshot().sessionId, "sess-1");
});

test("session implementation source does not embed provider credentials", () => {
  const forbidden = "NVIDIA" + "_API_KEY";
  const names = readdirSync(SESSION_DIR);
  let scanned = 0;
  for (const name of names) {
    if (name.includes(".test.") || name.endsWith(".d.ts")) {
      continue;
    }
    if (!name.endsWith(".ts") && !name.endsWith(".js")) {
      continue;
    }
    const source = readFileSync(join(SESSION_DIR, name), "utf8");
    scanned += 1;
    assert.equal(
      source.includes(forbidden),
      false,
      `${name} must not contain provider credential names`,
    );
    assert.equal(source.includes("authorization"), false, name);
  }
  assert.ok(scanned >= 3);
});

test("useGuiSession remains the exported React hook name", () => {
  const source = readSessionSource("use-gui-session");
  assert.match(source, /export function useGuiSession\(/);
  assert.match(source, /createGuiSessionClient/);
});

test("the view-facing connect settles instead of rejecting", async () => {
  const client = createClient();
  const connect = settleQuietly(client.connect);
  const settled = connect();
  fakeSockets[0]?.deliver({
    type: "error",
    requestId: "req-1",
    message: "host refused the session",
  });
  await settled;
  assert.equal(client.status, "error");
  assert.equal(client.error, "host refused the session");
});

test("the view-facing connect still resolves on a good handshake", async () => {
  const client = createClient();
  const connect = settleQuietly(client.connect);
  const settled = connect();
  const socket = fakeSockets.at(-1);
  assert.ok(socket);
  socket.open();
  socket.deliver({
    type: "session/new/ok",
    requestId: "req-1",
    sessionId: "sess-1",
  });
  await settled;
  assert.equal(client.status, "ready");
  assert.equal(client.sessionId, "sess-1");
});

function readSessionSource(basename: string): string {
  for (const name of [`${basename}.ts`, `${basename}.js`]) {
    try {
      return readFileSync(join(SESSION_DIR, name), "utf8");
    } catch {
      continue;
    }
  }
  throw new Error(`missing ${basename} in ${SESSION_DIR}`);
}
