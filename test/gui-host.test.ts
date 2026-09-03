import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createSpawnedAcpBridge, type AcpBridge } from "../src/gui-host/acp-bridge.js";
import { isAllowedOrigin } from "../src/gui-host/origin.js";
import { parseClientMessage } from "../src/gui-host/protocol.js";
import { redactWireText } from "../src/gui-host/redact.js";
import { startGuiHost, type GuiHost, type GuiHostOptions } from "../src/gui-host/server.js";

const SECRET = "gui-host-secret-do-not-leak-A008-0032";
const SESSION_ID = "sess-1";

/**
 * @param released - when given, every session the host releases is appended to
 * it, so a test can assert the release itself rather than infer it.
 */
function injectedBridge(released?: string[], ingested?: string[]): AcpBridge {
  let created = 0;
  return {
    async newSession() {
      created += 1;
      return { sessionId: created === 1 ? SESSION_ID : `sess-${String(created)}` };
    },
    async ingestSource(request) {
      ingested?.push(request.locator);
      return {
        artifactId: "A008_knowledge_artifact_upload-1",
        utteranceIds: ["A008_knowledge_utterance_upload-1"],
        relation: "appears_in",
        speaker: "user",
      };
    },
    async closeSession(sessionId) {
      released?.push(sessionId);
    },
    async prompt(_sessionId, text, handlers, signal) {
      if (text === "fail") {
        throw new Error("synthetic ACP failure");
      }
      if (text === "leak") {
        throw new Error(
          `NVIDIA_API_KEY=${SECRET} authorization=Bearer ${SECRET}`,
        );
      }
      handlers.onThought("thinking");
      if (text === "wait") {
        await new Promise<void>((resolve) => {
          if (signal.aborted) {
            resolve();
            return;
          }
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
        return;
      }
      handlers.onAnswer("hello");
    },
    cancel() {},
    async close() {},
  };
}

async function withHost(
  options: GuiHostOptions,
  run: (host: GuiHost) => Promise<void>,
): Promise<void> {
  const host = await startGuiHost({
    host: "127.0.0.1",
    port: 0,
    cwd: process.cwd(),
    env: { ...process.env, NVIDIA_API_KEY: SECRET },
    createAcpBridge: () => injectedBridge(),
    ...options,
  });
  try {
    await run(host);
  } finally {
    await host.close();
  }
}

async function httpJson(
  host: GuiHost,
  path: string,
  init: RequestInit = {},
): Promise<{ readonly status: number; readonly body: unknown; readonly raw: string }> {
  const response = await fetch(`http://127.0.0.1:${String(host.port)}${path}`, init);
  const raw = await response.text();
  return {
    status: response.status,
    raw,
    body: raw.length === 0 ? undefined : (JSON.parse(raw) as unknown),
  };
}

class SessionClient {
  readonly raw: string[] = [];
  readonly #queue: unknown[] = [];
  readonly #waiters: Array<(frame: unknown) => void> = [];
  readonly #ws: WebSocket;

  static async open(port: number): Promise<SessionClient> {
    const ws = new WebSocket(`ws://127.0.0.1:${String(port)}/v1/session`);
    const client = new SessionClient(ws);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => {
        reject(new Error("WebSocket failed to open."));
      }, { once: true });
    });
    return client;
  }

  constructor(ws: WebSocket) {
    this.#ws = ws;
    ws.addEventListener("message", (event) => {
      const raw = String(event.data);
      this.raw.push(raw);
      const parsed = JSON.parse(raw) as unknown;
      const waiter = this.#waiters.shift();
      if (waiter !== undefined) {
        waiter(parsed);
        return;
      }
      this.#queue.push(parsed);
    });
  }

  send(message: unknown): void {
    this.#ws.send(JSON.stringify(message));
  }

  next(timeoutMs = 5_000): Promise<unknown> {
    const queued = this.#queue.shift();
    if (queued !== undefined) {
      return Promise.resolve(queued);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for a WebSocket frame."));
      }, timeoutMs);
      this.#waiters.push((frame) => {
        clearTimeout(timer);
        resolve(frame);
      });
    });
  }

  close(): void {
    this.#ws.close();
  }
}

interface UpgradeAttempt {
  readonly status: number | undefined;
  readonly upgraded: boolean;
}

async function attemptUpgrade(
  port: number,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<UpgradeAttempt> {
  const outgoing = httpRequest({
    host: "127.0.0.1",
    port,
    path: "/v1/session",
    headers: {
      connection: "Upgrade",
      upgrade: "websocket",
      "sec-websocket-key": randomBytes(16).toString("base64"),
      "sec-websocket-version": "13",
      ...extraHeaders,
    },
  });
  return await new Promise<UpgradeAttempt>((resolve, reject) => {
    outgoing.on("upgrade", (_response, socket) => {
      socket.destroy();
      resolve({ status: undefined, upgraded: true });
    });
    outgoing.on("response", (response) => {
      response.resume();
      resolve({ status: response.statusCode, upgraded: false });
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
}

function assertWireClean(raw: readonly string[]): void {
  const joined = raw.join("\n");
  assert.equal(joined.includes(SECRET), false);
  assert.doesNotMatch(joined, /NVIDIA_API_KEY/u);
  assert.doesNotMatch(joined, /authorization/iu);
}

test("parseClientMessage accepts host protocol v1 client frames", () => {
  assert.deepEqual(
    parseClientMessage(
      JSON.stringify({ type: "session/new", requestId: "r1", model: "m" }),
    ),
    { type: "session/new", requestId: "r1", model: "m" },
  );
  assert.deepEqual(
    parseClientMessage(
      JSON.stringify({
        type: "prompt",
        requestId: "r2",
        sessionId: "s",
        text: "hi",
      }),
    ),
    { type: "prompt", requestId: "r2", sessionId: "s", text: "hi" },
  );
  assert.equal(
    "error" in parseClientMessage("{"),
    true,
  );
});

test("redactWireText removes credential names and values", () => {
  const redacted = redactWireText(
    `NVIDIA_API_KEY=${SECRET} authorization=Bearer ${SECRET}`,
    [SECRET],
  );
  assert.equal(redacted.includes(SECRET), false);
  assert.doesNotMatch(redacted, /NVIDIA_API_KEY/u);
  assert.doesNotMatch(redacted, /authorization/iu);
});

test("isAllowedOrigin admits loopback and same-origin browsers only", () => {
  assert.equal(isAllowedOrigin(undefined, "127.0.0.1:8787"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:8787", "127.0.0.1:8787"), true);
  assert.equal(isAllowedOrigin("http://localhost:5173", "127.0.0.1:8787"), true);
  assert.equal(isAllowedOrigin("https://a008.example", "a008.example"), true);
  assert.equal(isAllowedOrigin("https://evil.example", "127.0.0.1:8787"), false);
  assert.equal(isAllowedOrigin("null", "127.0.0.1:8787"), false);
  assert.equal(isAllowedOrigin("not a url", "127.0.0.1:8787"), false);
  assert.equal(isAllowedOrigin("file://", "127.0.0.1:8787"), false);
});

test("GET /health and /v1/models do not require a credential", async () => {
  await withHost({}, async (host) => {
    const health = await httpJson(host, "/health");
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { ok: true, name: "A008-gui-host" });
    const models = await httpJson(host, "/v1/models");
    assert.equal(models.status, 200);
    assert.deepEqual(models.body, {
      models: [
        {
          id: "nvidia/nemotron-3.5-lightning-30b-a3b",
          name: "NVIDIA Nemotron 3.5 Lightning 30B A3B",
        },
      ],
    });
    assertWireClean([health.raw, models.raw]);
  });
});

test("POST /v1/shell reuses the injected terminal runner in host cwd", async () => {
  const calls: Array<{ readonly command: string; readonly cwd: string }> = [];
  await withHost(
    {
      cwd: process.cwd(),
      runTerminal: async (input) => {
        calls.push({ command: input.command, cwd: input.cwd });
        return {
          command: input.command,
          cwd: input.cwd,
          exitCode: 0,
          signal: null,
          stdout: "out",
          stderr: "err",
          timedOut: false,
          truncated: false,
        };
      },
    },
    async (host) => {
      const result = await httpJson(host, "/v1/shell", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command: "echo hi" }),
      });
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, {
        stdout: "out",
        stderr: "err",
        exitCode: 0,
        timedOut: false,
        truncated: false,
      });
      assert.deepEqual(calls, [{ command: "echo hi", cwd: process.cwd() }]);
    },
  );
});

test("POST /v1/shell runs a local node process through runTerminalCommand", async () => {
  await withHost({}, async (host) => {
    const result = await httpJson(host, "/v1/shell", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        command: `node -e "process.stdout.write('shell-ok')"`,
      }),
    });
    assert.equal(result.status, 200);
    const body = result.body as { readonly stdout: string; readonly exitCode: number };
    assert.equal(body.exitCode, 0);
    assert.match(body.stdout, /shell-ok/u);
    const empty = await httpJson(host, "/v1/shell", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "   " }),
    });
    assert.equal(empty.status, 400);
  });
});

test("POST /v1/shell refuses cross-origin and non-JSON callers", async () => {
  let ran = 0;
  await withHost(
    {
      runTerminal: async (input) => {
        ran += 1;
        return {
          command: input.command,
          cwd: input.cwd,
          exitCode: 0,
          signal: null,
          stdout: "",
          stderr: "",
          timedOut: false,
          truncated: false,
        };
      },
    },
    async (host) => {
      const crossOrigin = await httpJson(host, "/v1/shell", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ command: "echo owned" }),
      });
      assert.equal(crossOrigin.status, 403);

      // A cross-origin HTML form can only send these content types, so a
      // simple-request CSRF must not reach the shell.
      const formShaped = await httpJson(host, "/v1/shell", {
        method: "POST",
        headers: { "content-type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ command: "echo owned" }),
      });
      assert.equal(formShaped.status, 415);

      assert.equal(ran, 0);
    },
  );
});

test("HTTP failures carry the message field the GUI shell client reads", async () => {
  await withHost({}, async (host) => {
    const missing = await httpJson(host, "/v1/nope");
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, {
      error: "Not found.",
      message: "Not found.",
    });
    const empty = await httpJson(host, "/v1/shell", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "   " }),
    });
    assert.equal(empty.status, 400);
    const body = empty.body as { readonly message: string };
    assert.equal(body.message, "Terminal command must not be empty.");
  });
});

test("WebSocket upgrade refuses a cross-origin page", async () => {
  await withHost({}, async (host) => {
    const blocked = await attemptUpgrade(host.port, {
      origin: "https://evil.example",
    });
    assert.deepEqual(blocked, { status: 403, upgraded: false });
    const allowed = await attemptUpgrade(host.port, {
      origin: `http://127.0.0.1:${String(host.port)}`,
    });
    assert.equal(allowed.upgraded, true);
    const wrongPath = await httpJson(host, "/health", {
      headers: { origin: "https://evil.example" },
    });
    assert.equal(wrongPath.status, 403);
  });
});

test("WebSocket session streams thought and answer then prompt/ok", async () => {
  await withHost({}, async (host) => {
    const client = await SessionClient.open(host.port);
    try {
      client.send({ type: "session/new", requestId: "n1" });
      assert.deepEqual(await client.next(), {
        type: "session/new/ok",
        requestId: "n1",
        sessionId: SESSION_ID,
      });
      client.send({
        type: "prompt",
        requestId: "p1",
        sessionId: SESSION_ID,
        text: "hello",
      });
      assert.deepEqual(await client.next(), {
        type: "thought",
        sessionId: SESSION_ID,
        text: "thinking",
      });
      assert.deepEqual(await client.next(), {
        type: "answer",
        sessionId: SESSION_ID,
        text: "hello",
      });
      assert.deepEqual(await client.next(), {
        type: "prompt/ok",
        requestId: "p1",
        sessionId: SESSION_ID,
      });
      assertWireClean(client.raw);
    } finally {
      client.close();
    }
  });
});

/** Waits for a condition the host reaches asynchronously after a socket close. */
async function eventually(
  check: () => boolean,
  what: string,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${what}.`);
}

test("a disconnecting renderer releases every session it owned", async () => {
  const released: string[] = [];
  await withHost(
    { createAcpBridge: () => injectedBridge(released) },
    async (host) => {
      const client = await SessionClient.open(host.port);
      client.send({ type: "session/new", requestId: "n1" });
      await client.next();
      client.send({ type: "session/new", requestId: "n2" });
      await client.next();
      assert.deepEqual(released, [], "sessions must survive while the socket is open");

      client.close();
      await eventually(() => released.length === 2, "both sessions to be released");
      assert.deepEqual([...released].sort(), ["sess-1", "sess-2"]);
    },
  );
});

test("one renderer disconnecting leaves another renderer's session alone", async () => {
  const released: string[] = [];
  await withHost(
    { createAcpBridge: () => injectedBridge(released) },
    async (host) => {
      const first = await SessionClient.open(host.port);
      first.send({ type: "session/new", requestId: "n1" });
      await first.next();
      const second = await SessionClient.open(host.port);
      second.send({ type: "session/new", requestId: "n2" });
      await second.next();

      first.close();
      await eventually(() => released.length === 1, "the first session to be released");
      assert.deepEqual(released, ["sess-1"]);

      // The survivor is still usable, which is the point of per-socket ownership.
      second.send({
        type: "prompt",
        requestId: "p1",
        sessionId: "sess-2",
        text: "hello",
      });
      assert.deepEqual(await second.next(), {
        type: "thought",
        sessionId: "sess-2",
        text: "thinking",
      });
      second.close();
      await eventually(() => released.length === 2, "the second session to be released");
    },
  );
});

test("a socket that opened no session releases nothing and starts no bridge", async () => {
  const released: string[] = [];
  let bridgesCreated = 0;
  await withHost(
    {
      createAcpBridge: () => {
        bridgesCreated += 1;
        return injectedBridge(released);
      },
    },
    async (host) => {
      const client = await SessionClient.open(host.port);
      client.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(bridgesCreated, 0, "closing an idle socket must not spawn ACP");
      assert.deepEqual(released, []);
    },
  );
});

test("a failing release does not take the host down", async () => {
  const attempted: string[] = [];
  await withHost(
    {
      createAcpBridge: () => {
        const bridge = injectedBridge();
        return {
          ...bridge,
          async closeSession(sessionId) {
            attempted.push(sessionId);
            throw new Error("synthetic release failure");
          },
        };
      },
    },
    async (host) => {
      const client = await SessionClient.open(host.port);
      client.send({ type: "session/new", requestId: "n1" });
      await client.next();
      client.close();
      await eventually(() => attempted.length === 1, "the release attempt");

      // The host is still serving after the rejected release.
      const health = await httpJson(host, "/health");
      assert.deepEqual(health.body, { ok: true, name: "A008-gui-host" });
    },
  );
});

test("disconnecting while a prompt streams aborts the turn and still releases", async () => {
  const released: string[] = [];
  await withHost(
    { createAcpBridge: () => injectedBridge(released) },
    async (host) => {
      const client = await SessionClient.open(host.port);
      client.send({ type: "session/new", requestId: "n1" });
      await client.next();
      client.send({
        type: "prompt",
        requestId: "p1",
        sessionId: SESSION_ID,
        text: "wait",
      });
      assert.deepEqual(await client.next(), {
        type: "thought",
        sessionId: SESSION_ID,
        text: "thinking",
      });

      // "wait" only resolves when the prompt signal aborts, so a release that
      // arrives at all proves the in-flight turn was abandoned, not orphaned.
      client.close();
      await eventually(() => released.length === 1, "release after an aborted turn");
      assert.deepEqual(released, [SESSION_ID]);
    },
  );
});

test("WebSocket cancel ends an in-flight prompt", async () => {
  await withHost({}, async (host) => {
    const client = await SessionClient.open(host.port);
    try {
      client.send({ type: "session/new", requestId: "n1" });
      await client.next();
      client.send({
        type: "prompt",
        requestId: "p1",
        sessionId: SESSION_ID,
        text: "wait",
      });
      assert.deepEqual(await client.next(), {
        type: "thought",
        sessionId: SESSION_ID,
        text: "thinking",
      });
      client.send({
        type: "cancel",
        requestId: "c1",
        sessionId: SESSION_ID,
      });
      assert.deepEqual(await client.next(), {
        type: "prompt/ok",
        requestId: "p1",
        sessionId: SESSION_ID,
      });
      assertWireClean(client.raw);
    } finally {
      client.close();
    }
  });
});

test("WebSocket error path stays free of credentials", async () => {
  await withHost({}, async (host) => {
    const client = await SessionClient.open(host.port);
    try {
      client.send({ type: "session/new", requestId: "n1" });
      await client.next();
      client.send({
        type: "prompt",
        requestId: "p1",
        sessionId: "missing",
        text: "hello",
      });
      assert.deepEqual(await client.next(), {
        type: "error",
        requestId: "p1",
        sessionId: "missing",
        message: "Unknown session.",
      });
      client.send({
        type: "prompt",
        requestId: "p2",
        sessionId: SESSION_ID,
        text: "fail",
      });
      assert.deepEqual(await client.next(), {
        type: "error",
        requestId: "p2",
        sessionId: SESSION_ID,
        message: "synthetic ACP failure",
      });
      client.send({
        type: "prompt",
        requestId: "p3",
        sessionId: SESSION_ID,
        text: "leak",
      });
      const leaked = await client.next();
      assert.deepEqual(leaked, {
        type: "error",
        requestId: "p3",
        sessionId: SESSION_ID,
        message: "[redacted]=[redacted] [redacted]=Bearer [redacted]",
      });
      assertWireClean(client.raw);
    } finally {
      client.close();
    }
  });
});

test("GUI host serves static files from the configured directory", async () => {
  const directory = mkdtempSync(join(tmpdir(), "A008-gui-host-"));
  writeFileSync(join(directory, "index.html"), "<html>A008</html>", "utf8");
  await withHost({ staticDir: directory }, async (host) => {
    const response = await fetch(`http://127.0.0.1:${String(host.port)}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /A008/u);
  });
});

function spawnedFakeAcp(): GuiHostOptions {
  return {
    createAcpBridge: () =>
      createSpawnedAcpBridge({
        env: { ...process.env, NVIDIA_API_KEY: SECRET },
        cwd: process.cwd(),
        agentPath: fileURLToPath(
          new URL("./gui-host/fake-acp.js", import.meta.url),
        ),
      }),
  };
}

async function openFakeAcpSession(
  host: GuiHost,
): Promise<{ readonly client: SessionClient; readonly sessionId: string }> {
  const client = await SessionClient.open(host.port);
  client.send({ type: "session/new", requestId: "n1" });
  const created = (await client.next()) as {
    readonly type: string;
    readonly sessionId: string;
  };
  assert.equal(created.type, "session/new/ok");
  assert.match(created.sessionId, /^A008_v1_acp_session_/u);
  return { client, sessionId: created.sessionId };
}

test("spawned fake ACP bridge streams thought and answer", async () => {
  await withHost(
    spawnedFakeAcp(),
    async (host) => {
      const client = await SessionClient.open(host.port);
      try {
        client.send({
          type: "session/new",
          requestId: "n1",
          model: "nvidia/nemotron-3.5-lightning-30b-a3b",
        });
        const created = (await client.next()) as {
          readonly type: string;
          readonly sessionId: string;
        };
        assert.equal(created.type, "session/new/ok");
        assert.match(created.sessionId, /^A008_v1_acp_session_/u);
        client.send({
          type: "prompt",
          requestId: "p1",
          sessionId: created.sessionId,
          text: "hello",
        });
        assert.deepEqual(await client.next(), {
          type: "thought",
          sessionId: created.sessionId,
          text: "thinking",
        });
        assert.deepEqual(await client.next(), {
          type: "answer",
          sessionId: created.sessionId,
          text: "hello",
        });
        assert.deepEqual(await client.next(), {
          type: "prompt/ok",
          requestId: "p1",
          sessionId: created.sessionId,
        });
        assertWireClean(client.raw);
      } finally {
        client.close();
      }
    },
  );
});

test("spawned fake ACP bridge cancels an in-flight prompt over stdio", async () => {
  await withHost(spawnedFakeAcp(), async (host) => {
    const { client, sessionId } = await openFakeAcpSession(host);
    try {
      client.send({ type: "prompt", requestId: "p1", sessionId, text: "wait" });
      assert.deepEqual(await client.next(), {
        type: "thought",
        sessionId,
        text: "thinking",
      });
      client.send({ type: "cancel", requestId: "c1", sessionId });
      assert.deepEqual(await client.next(), {
        type: "prompt/ok",
        requestId: "p1",
        sessionId,
      });
      assertWireClean(client.raw);
    } finally {
      client.close();
    }
  });
});

test("spawned fake ACP bridge reports a failed turn as an error frame", async () => {
  await withHost(spawnedFakeAcp(), async (host) => {
    const { client, sessionId } = await openFakeAcpSession(host);
    try {
      client.send({ type: "prompt", requestId: "p1", sessionId, text: "fail" });
      assert.deepEqual(await client.next(), {
        type: "error",
        requestId: "p1",
        sessionId,
        message: "synthetic ACP failure",
      });

      // The ACP subprocess survives a failed turn and the session still works.
      client.send({ type: "prompt", requestId: "p2", sessionId, text: "hello" });
      assert.deepEqual(await client.next(), {
        type: "thought",
        sessionId,
        text: "thinking",
      });
      assert.deepEqual(await client.next(), {
        type: "answer",
        sessionId,
        text: "hello",
      });
      assert.deepEqual(await client.next(), {
        type: "prompt/ok",
        requestId: "p2",
        sessionId,
      });
      assertWireClean(client.raw);
    } finally {
      client.close();
    }
  });
});

function uploadStore(): string {
  return mkdtempSync(join(tmpdir(), "A008-source-store-"));
}

async function upload(
  host: GuiHost,
  body: string,
  filename: string,
  extraHeaders: Readonly<Record<string, string>> = {},
): Promise<{ readonly status: number; readonly body: unknown; readonly raw: string }> {
  return await httpJson(host, "/v1/upload", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-a008-filename": filename,
      ...extraHeaders,
    },
    body,
  });
}

test("POST /v1/upload stores the original and reports a content-addressed locator", async () => {
  const storeRoot = uploadStore();
  const ingested: string[] = [];
  await withHost(
    {
      sourceStorePath: storeRoot,
      createAcpBridge: () => injectedBridge(undefined, ingested),
    },
    async (host) => {
      const result = await upload(host, "A008 upload body.", "report.txt");
      assert.equal(result.status, 200);
      const body = result.body as Record<string, unknown>;

      assert.equal(body.mediaType, "text/plain");
      assert.equal(body.bytes, 17);
      assert.equal(body.extracted, true);
      assert.equal(typeof body.sha256, "string");
      assert.equal(body.locator, `source:${String(body.sha256)}/report.txt`);
      // The bridge was asked to ingest by locator only; bytes never cross ACP.
      assert.deepEqual(ingested, [body.locator]);
      assert.equal(
        readFileSync(join(storeRoot, String(body.sha256), "report.txt"), "utf8"),
        "A008 upload body.",
      );
      assertWireClean([result.raw]);
    },
  );
});

test("the same bytes twice yield one locator and one stored blob", async () => {
  const storeRoot = uploadStore();
  await withHost({ sourceStorePath: storeRoot }, async (host) => {
    const first = (await upload(host, "identical", "a.txt")).body as Record<string, unknown>;
    const second = (await upload(host, "identical", "a.txt")).body as Record<string, unknown>;

    assert.equal(first.locator, second.locator);
    assert.equal(first.sha256, second.sha256);
    assert.deepEqual(readdirSync(join(storeRoot, String(first.sha256))), ["a.txt"]);
  });
});

test("a hostile filename cannot place a file outside the store", async () => {
  const storeRoot = uploadStore();
  await withHost({ sourceStorePath: storeRoot }, async (host) => {
    for (const declared of [
      "../../escape.txt",
      "..%2F..%2Fescape.txt",
      "sub/dir/escape.txt",
      "..",
      "   ",
    ]) {
      const body = (await upload(host, `x-${declared}`, declared)).body as Record<
        string,
        unknown
      >;
      const locator = String(body.locator);
      const name = locator.slice(locator.lastIndexOf("/") + 1);
      assert.equal(name.includes(".."), false, `no traversal in ${locator}`);
      assert.equal(/[\/]/u.test(name), false, `no separator in ${locator}`);
      // Every written file is exactly one level under its hash directory.
      const written = join(storeRoot, String(body.sha256), name);
      assert.equal(existsSync(written), true, `stored at ${written}`);
      assert.equal(relative(storeRoot, written).startsWith(".."), false);
    }
    // Nothing was created beside the store root.
    assert.equal(existsSync(join(dirname(storeRoot), "escape.txt")), false);
  });
});

test("an oversized upload is refused and nothing is written", async () => {
  const storeRoot = uploadStore();
  await withHost({ sourceStorePath: storeRoot, maxUploadBytes: 16 }, async (host) => {
    // Refusing an oversized stream tears the connection down rather than
    // politely finishing it, so either a non-200 status or a transport-level
    // failure counts as a refusal. What must hold is that nothing is stored.
    let accepted = false;
    try {
      const result = await upload(host, "x".repeat(64), "big.txt");
      accepted = result.status === 200;
      if (!accepted) {
        assert.match(
          String((result.body as { message?: string }).message ?? ""),
          /large/iu,
        );
      }
    } catch {
      accepted = false;
    }
    assert.equal(accepted, false, "an oversized upload must never succeed");
    assert.deepEqual(readdirSync(storeRoot), [], "nothing written");

    // The host is still serving afterwards.
    const health = await httpJson(host, "/health");
    assert.deepEqual(health.body, { ok: true, name: "A008-gui-host" });
  });
});

test("POST /v1/upload requires the octet-stream content type", async () => {
  const storeRoot = uploadStore();
  await withHost({ sourceStorePath: storeRoot }, async (host) => {
    const result = await httpJson(host, "/v1/upload", {
      method: "POST",
      headers: { "content-type": "application/json", "x-a008-filename": "a.txt" },
      body: "{}",
    });
    assert.equal(result.status, 415);
    assert.deepEqual(readdirSync(storeRoot), []);
  });
});

test("POST /v1/upload refuses a cross-origin caller", async () => {
  const storeRoot = uploadStore();
  await withHost({ sourceStorePath: storeRoot }, async (host) => {
    const result = await upload(host, "x", "a.txt", {
      origin: "https://evil.example",
    });
    assert.equal(result.status, 403);
    assert.deepEqual(readdirSync(storeRoot), []);
  });
});

test("a stored upload survives a failing ingestion", async () => {
  const storeRoot = uploadStore();
  await withHost(
    {
      sourceStorePath: storeRoot,
      createAcpBridge: () => {
        const bridge = injectedBridge();
        return {
          ...bridge,
          async ingestSource() {
            throw new Error("synthetic ingest failure");
          },
        };
      },
    },
    async (host) => {
      const result = await upload(host, "kept anyway", "keep.txt");
      assert.equal(result.status, 200);
      const body = result.body as Record<string, unknown>;
      // The blob is durable; only extraction failed.
      assert.equal(body.extracted, false);
      assert.equal(body.artifactId, undefined);
      assert.equal(
        readFileSync(join(storeRoot, String(body.sha256), "keep.txt"), "utf8"),
        "kept anyway",
      );
    },
  );
});

test("the bridge sends _a008/source/ingest over a real ACP subprocess", async () => {
  const storeRoot = uploadStore();
  await withHost(
    { ...spawnedFakeAcp(), sourceStorePath: storeRoot },
    async (host) => {
      const result = await upload(host, "over stdio", "stdio.txt");
      assert.equal(result.status, 200);
      const body = result.body as Record<string, unknown>;
      assert.equal(body.extracted, true);
      assert.equal(typeof body.artifactId, "string");
      assertWireClean([result.raw]);
    },
  );
});
