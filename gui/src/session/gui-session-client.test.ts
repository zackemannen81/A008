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
import type { SessionSnapshot } from "./session-controls.js";
import { buildChatTranscript } from "../chat/chat-transcript.js";

const ALLOWED_CLIENT_KEYS = new Set<string>(CLIENT_MESSAGE_KEYS);
const RESUME_TOKEN = "a".repeat(64);
const SESSION_DIR = dirname(fileURLToPath(import.meta.url));
const controlledState: SessionSnapshot = {
  model: DEFAULT_GUI_MODEL,
  parameters: {
    stream: true,
    temperature: 1,
    topP: 0.95,
    maxTokens: 16384,
    enableThinking: true,
    reasoningBudget: 4096,
    reasoningEffort: null,
    seed: null,
    stop: null,
  },
  messages: [],
  runtime: {
    cwd: "C:/fixture",
    projectId: "fixture-project",
    memoryPath: "C:/fixture/memory.sqlite",
  },
};

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
    reconnectDelaysMs?: readonly number[];
  } = {},
): GuiSessionClient {
  fakeSockets.length = 0;
  let nextId = 0;
  return createGuiSessionClient({
    url: overrides.url ?? "ws://gui.test/v1/session",
    model: overrides.model,
    reconnectDelaysMs: overrides.reconnectDelaysMs,
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
    resumeToken: RESUME_TOKEN,
  });
  await pending;
  return socket;
}

function parsedFrames(socket: FakeWebSocket): Record<string, unknown>[] {
  return socket.sent.map(
    (frame) => JSON.parse(frame) as Record<string, unknown>,
  );
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

test("resume frames carry only the bounded session capability", () => {
  const encoded = JSON.parse(
    encodeClientMessage({
      type: "session/resume",
      requestId: "r",
      sessionId: "s",
      resumeToken: RESUME_TOKEN,
    }),
  ) as Record<string, unknown>;
  assert.deepEqual(encoded, {
    type: "session/resume",
    requestId: "r",
    sessionId: "s",
    resumeToken: RESUME_TOKEN,
  });
  assert.deepEqual(
    parseServerMessage({
      type: "session/resume/ok",
      requestId: "r",
      sessionId: "s",
      resumeToken: RESUME_TOKEN,
    }),
    {
      type: "session/resume/ok",
      requestId: "r",
      sessionId: "s",
      resumeToken: RESUME_TOKEN,
    },
  );
  assert.throws(
    () =>
      parseServerMessage({
        type: "session/resume/ok",
        requestId: "r",
        sessionId: "s",
        resumeToken: "bad",
      }),
    /resume capability/u,
  );
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

test("image prompt sends bounded locator metadata and surfaces unsupported-model errors", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const attachment = {
    type: "image" as const,
    locator: `source:${"a".repeat(64)}/photo.png`,
    mediaType: "image/png",
  };
  const pending = client.prompt("look at this", attachment);
  assert.deepEqual(parsedFrames(socket)[1], {
    type: "prompt",
    requestId: "req-2",
    sessionId: "sess-1",
    text: "look at this",
    attachment,
  });
  const message =
    "Model nvidia/nemotron-3.5-lightning-30b-a3b does not declare image input support.";
  socket.deliver({
    type: "error",
    requestId: "req-2",
    sessionId: "sess-1",
    message,
  });
  await assert.rejects(
    pending,
    new RegExp(message.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
  );
  assert.equal(client.error, message);
  assert.equal(client.status, "ready");
  assert.equal(client.busy, false);
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
  assert.deepEqual(client.getSnapshot().tools ?? [], []);
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

test("a new prompt starts a fresh tool list", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const first = client.prompt("read then write");
  socket.deliver({
    type: "tool",
    sessionId: "sess-1",
    id: "read-1",
    title: "read_file",
    status: "completed",
    text: "ok",
  });
  socket.deliver({
    type: "prompt/ok",
    requestId: "req-2",
    sessionId: "sess-1",
  });
  await first;
  assert.equal(client.getSnapshot().tools?.length, 1);

  const second = client.prompt("edit again");
  assert.deepEqual(client.getSnapshot().tools ?? [], []);
  socket.deliver({
    type: "tool",
    sessionId: "sess-1",
    id: "edit-2",
    title: "edit_file",
    status: "completed",
    text: "ok",
  });
  socket.deliver({
    type: "prompt/ok",
    requestId: "req-3",
    sessionId: "sess-1",
  });
  await second;
  assert.deepEqual(
    client.getSnapshot().tools?.map((tool) => tool.id),
    ["edit-2"],
  );
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

test("cancel waits for the host before releasing the in-flight prompt", async () => {
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
  assert.equal(client.busy, true);
  await assert.rejects(client.prompt("too early"), /in progress/);
  socket.deliver({
    type: "prompt/ok",
    requestId: "req-2",
    sessionId: "sess-1",
  });
  await assert.rejects(pending, /cancelled/);
  assert.equal(client.busy, false);
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

test("unexpected socket loss automatically resumes the same session with bounded backoff", async () => {
  const client = createClient({ reconnectDelaysMs: [0] });
  const first = await becomeReady(client);
  first.deliver({
    type: "tool/permission",
    sessionId: "sess-1",
    id: "first",
    title: "exec_command",
    text: "one",
  });
  client.resolveToolPermission!("allow_all");
  first.fail();
  assert.equal(client.status, "connecting");
  assert.equal(client.sessionId, "sess-1");
  assert.equal(client.error, undefined);

  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = fakeSockets.at(-1)!;
  assert.notEqual(second, first);
  second.open();
  const resume = parsedFrames(second)[0]!;
  assert.deepEqual(resume, {
    type: "session/resume",
    requestId: resume.requestId,
    sessionId: "sess-1",
    resumeToken: RESUME_TOKEN,
  });
  second.deliver({
    type: "session/resume/ok",
    requestId: resume.requestId,
    sessionId: "sess-1",
    resumeToken: RESUME_TOKEN,
    state: controlledState,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(client.status, "ready");
  assert.equal(client.sessionId, "sess-1");

  const before = second.sent.length;
  second.deliver({
    type: "tool/permission",
    sessionId: "sess-1",
    id: "after",
    title: "git",
    text: "two",
  });
  assert.equal(
    client.getSnapshot().permission?.id,
    "after",
    "Allow all must not survive transport loss",
  );
  assert.equal(second.sent.length, before);
});

test("transport loss rejects in-flight work and never replays the prompt on resume", async () => {
  const client = createClient({ reconnectDelaysMs: [0] });
  const first = await becomeReady(client);
  const pending = client.prompt("do not replay");
  first.fail();
  await assert.rejects(pending, /interrupted/);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = fakeSockets.at(-1)!;
  second.open();
  const frames = parsedFrames(second);
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.type, "session/resume");
  assert.equal(
    frames.some((frame) => frame.type === "prompt"),
    false,
  );
  second.deliver({
    type: "session/resume/ok",
    requestId: frames[0]?.requestId,
    sessionId: "sess-1",
    resumeToken: RESUME_TOKEN,
    state: controlledState,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(client.status, "ready");
});

test("a refused resume stops reconnecting and requires a fresh manual connection", async () => {
  const client = createClient({ reconnectDelaysMs: [0] });
  const first = await becomeReady(client);
  first.fail();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = fakeSockets.at(-1)!;
  second.open();
  const resume = parsedFrames(second)[0]!;
  second.deliver({
    type: "error",
    requestId: resume.requestId,
    sessionId: "sess-1",
    message: "Session resume is unavailable or expired.",
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(client.status, "error");
  assert.equal(client.sessionId, undefined);
  assert.equal(fakeSockets.length, 2);

  const fresh = client.connect();
  const third = fakeSockets.at(-1)!;
  third.open();
  const request = parsedFrames(third)[0]!;
  assert.equal(request.type, "session/new");
  third.deliver({
    type: "session/new/ok",
    requestId: request.requestId,
    sessionId: "sess-2",
    resumeToken: RESUME_TOKEN,
  });
  await fresh;
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
    // The engine capability is local/session-scoped. Provider credentials
    // remain forbidden in every module, including engine-access.
    if (name !== "engine-access.ts")
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

test("controls only replace settings on a matching acknowledgment and preserve them on failure", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const initial = client.controlSession!({ action: "inspect" });
  socket.deliver({
    type: "session/control/ok",
    sessionId: "sess-1",
    requestId: "req-2",
    state: controlledState,
  });
  await initial;
  const parameters = { ...controlledState.parameters, temperature: null };
  const pending = client.controlSession!({ action: "configure", parameters });
  assert.equal(client.busy, true);
  assert.equal(client.details?.parameters.temperature, 1);
  socket.deliver({
    type: "session/control/ok",
    sessionId: "foreign",
    requestId: "req-3",
    state: { ...controlledState, parameters },
  });
  assert.equal(client.details?.parameters.temperature, 1);
  socket.deliver({
    type: "error",
    sessionId: "sess-1",
    requestId: "req-3",
    message: "Invalid parameters",
  });
  await assert.rejects(pending, /Invalid parameters/);
  assert.equal(client.busy, false);
  assert.equal(client.details?.parameters.temperature, 1);
  const retry = client.controlSession!({ action: "configure", parameters });
  socket.deliver({
    type: "session/control/ok",
    sessionId: "sess-1",
    requestId: "req-4",
    state: { ...controlledState, parameters },
  });
  await retry;
  assert.equal(client.details?.parameters.temperature, null);
});

test("committed history and transient thought render once, stop being live, and disappear on reset", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const initial = client.controlSession!({ action: "inspect" });
  socket.deliver({
    type: "session/control/ok",
    sessionId: "sess-1",
    requestId: "req-2",
    state: controlledState,
  });
  await initial;
  const pending = client.prompt("Question");
  socket.deliver({
    type: "thought",
    sessionId: "sess-1",
    text: "Display only",
  });
  socket.deliver({ type: "answer", sessionId: "sess-1", text: "Answer" });
  let transcript = buildChatTranscript({ session: client });
  assert.equal(transcript.turns.length, 2);
  const live = transcript.turns.at(-1);
  assert.ok(live?.kind === "assistant");
  assert.equal(live.live, true);
  const state: SessionSnapshot = {
    ...controlledState,
    messages: [
      { role: "user", content: "Question" },
      { role: "assistant", content: "Answer" },
    ],
  };
  socket.deliver({
    type: "prompt/ok",
    sessionId: "sess-1",
    requestId: "req-3",
    state,
  });
  await pending;
  transcript = buildChatTranscript({ session: client });
  assert.equal(transcript.turns.length, 2);
  const last = transcript.turns.at(-1);
  assert.ok(last?.kind === "assistant");
  assert.equal(last.live, false);
  assert.equal(last.thought, "Display only");
  assert.equal(
    JSON.stringify(client.details?.messages).includes("Display only"),
    false,
  );
  const reset = client.controlSession!({ action: "reset" });
  socket.deliver({
    type: "session/control/ok",
    sessionId: "sess-1",
    requestId: "req-4",
    state: controlledState,
  });
  await reset;
  assert.equal(buildChatTranscript({ session: client }).empty, true);
  assert.equal(client.thought, "");
});

test("model changes synchronize the client and exit closes the socket and active prompt", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const change = client.controlSession!({
    action: "model",
    model: "moonshotai/kimi-k3",
  });
  const state = { ...controlledState, model: "moonshotai/kimi-k3" };
  socket.deliver({
    type: "session/control/ok",
    sessionId: "sess-1",
    requestId: "req-2",
    state,
  });
  await change;
  assert.equal(client.model, state.model);
  const pending = client.prompt("Pending question");
  const rejection = assert.rejects(pending, /ended/);
  const ended = client.endSession!();
  socket.deliver({
    type: "session/control/ok",
    sessionId: "sess-1",
    requestId: "req-4",
    state: { ...state, closed: true },
  });
  await ended;
  await rejection;
  assert.equal(client.status, "idle");
  assert.equal(client.sessionId, undefined);
  assert.equal(socket.readyState, 3);
  socket.deliver({ type: "answer", sessionId: "sess-1", text: "Late answer" });
  assert.equal(client.answer, "");
  const connected = client.connect();
  const next = fakeSockets.at(-1)!;
  next.open();
  assert.equal(parsedFrames(next)[0]?.model, state.model);
  next.deliver({
    type: "session/new/ok",
    sessionId: "sess-2",
    requestId: "req-5",
    state,
  });
  await connected;
});

test("project switch can reconnect after the old host session rejects close", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  const ended = client.endSession!();
  const rejection = assert.rejects(ended, /Unknown A008 ACP session/);
  socket.deliver({
    type: "error",
    requestId: "req-2",
    message: "Unknown A008 ACP session: sess-1",
  });
  await rejection;
  assert.equal(client.status, "idle");
  assert.equal(client.sessionId, undefined);
  assert.equal(client.busy, false);
  assert.equal(socket.readyState, 3);
  socket.deliver({ type: "answer", sessionId: "sess-1", text: "Late answer" });
  assert.equal(client.answer, "");

  const connecting = client.connect();
  const next = fakeSockets.at(-1)!;
  assert.notEqual(next, socket);
  next.open();
  assert.equal(parsedFrames(next)[0]?.type, "session/new");
  next.deliver({
    type: "session/new/ok",
    sessionId: "sess-2",
    requestId: "req-3",
    state: controlledState,
  });
  await connecting;
  assert.equal(client.status, "ready");
  assert.equal(client.sessionId, "sess-2");
  assert.equal(client.error, undefined);
  client.dispose();
});

test("malformed snapshots cannot introduce a system message into GUI history", () => {
  assert.throws(
    () =>
      parseServerMessage({
        type: "session/control/ok",
        requestId: "r",
        sessionId: "s",
        state: {
          ...controlledState,
          messages: [{ role: "system", content: "private" }],
        },
      }),
    /invalid session snapshot/,
  );
});

test("Allow all auto-approves later tools in one GUI session and resets on reconnect", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  socket.deliver({
    type: "tool/permission",
    sessionId: "sess-1",
    id: "first",
    title: "exec_command",
    text: "one",
  });
  assert.equal(client.getSnapshot().permission?.id, "first");
  client.resolveToolPermission!("allow_all");
  assert.deepEqual(parsedFrames(socket).at(-1), {
    type: "tool/permission",
    requestId: "req-2",
    sessionId: "sess-1",
    permissionId: "first",
    allow: true,
  });
  assert.equal(client.getSnapshot().permission, undefined);

  const beforeSecond = socket.sent.length;
  socket.deliver({
    type: "tool/permission",
    sessionId: "sess-1",
    id: "second",
    title: "git",
    text: "two",
  });
  assert.equal(client.getSnapshot().permission, undefined);
  assert.equal(socket.sent.length, beforeSecond + 1);
  assert.deepEqual(parsedFrames(socket).at(-1), {
    type: "tool/permission",
    requestId: "req-3",
    sessionId: "sess-1",
    permissionId: "second",
    allow: true,
  });

  client.dispose();
  const reconnect = client.connect();
  const next = fakeSockets.at(-1)!;
  next.open();
  const request = parsedFrames(next)[0]!;
  next.deliver({
    type: "session/new/ok",
    requestId: request.requestId,
    sessionId: "sess-2",
  });
  await reconnect;
  const beforeThird = next.sent.length;
  next.deliver({
    type: "tool/permission",
    sessionId: "sess-2",
    id: "third",
    title: "exec_command",
    text: "three",
  });
  assert.equal(client.getSnapshot().permission?.id, "third");
  assert.equal(next.sent.length, beforeThird);
});

test("borrowed panel observes native work, rejects foreign permissions and detaches without closing its session", async () => {
  const client = createClient();
  const socket = await becomeReady(client);
  socket.deliver({
    type: "session/activity",
    sessionId: "sess-1",
    active: true,
    text: "Native question",
    state: controlledState,
  });
  assert.equal(client.busy, true);
  assert.equal(client.pendingText, "Native question");
  socket.deliver({
    type: "tool/permission",
    sessionId: "foreign",
    id: "bad",
    title: "Bad",
    text: "",
  });
  assert.equal(client.getSnapshot().permission, undefined);
  socket.deliver({
    type: "tool/permission",
    sessionId: "sess-1",
    id: "once",
    title: "exec_command",
    text: "fixture",
  });
  assert.ok(client.resolveToolPermission);
  client.resolveToolPermission("reject");
  assert.equal(parsedFrames(socket).at(-1)?.allow, false);
  assert.equal(client.getSnapshot().permission, undefined);
  socket.deliver({
    type: "session/activity",
    sessionId: "sess-1",
    active: false,
    state: controlledState,
  });
  assert.equal(client.busy, false);
  const before = socket.sent.length;
  client.dispose();
  assert.equal(socket.sent.length, before);
  assert.equal(socket.readyState, 3);
  socket.deliver({
    type: "session/activity",
    sessionId: "sess-1",
    active: true,
  });
  assert.equal(client.busy, false);
});
