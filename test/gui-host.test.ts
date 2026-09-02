import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createSpawnedAcpBridge, type AcpBridge } from "../src/gui-host/acp-bridge.js";
import { parseClientMessage } from "../src/gui-host/protocol.js";
import { redactWireText } from "../src/gui-host/redact.js";
import { startGuiHost, type GuiHost, type GuiHostOptions } from "../src/gui-host/server.js";

const SECRET = "gui-host-secret-do-not-leak-A008-0032";
const SESSION_ID = "sess-1";

function injectedBridge(): AcpBridge {
  let created = 0;
  return {
    async newSession() {
      created += 1;
      return { sessionId: created === 1 ? SESSION_ID : `sess-${String(created)}` };
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

test("spawned fake ACP bridge streams thought and answer", async () => {
  await withHost(
    {
      createAcpBridge: () =>
        createSpawnedAcpBridge({
          env: { ...process.env, NVIDIA_API_KEY: SECRET },
          cwd: process.cwd(),
          agentPath: fileURLToPath(
            new URL("./gui-host/fake-acp.js", import.meta.url),
          ),
        }),
    },
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
