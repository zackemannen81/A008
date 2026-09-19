import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Database from "better-sqlite3";
import {
  v2ErrorSchema,
  v2InfoSchema,
  v2SessionAuthenticatedSchema,
  v2SessionResultSchema,
  v2SessionServerFrameSchema,
  v2TicketResponseSchema,
} from "../packages/protocol/src/index.js";
import { executeProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";
import { DeviceRegistry } from "../src/gui-host/device-registry.js";
import { createPinAuthGate } from "../src/gui-host/pin-auth.js";
import { startGuiHost } from "../src/gui-host/server.js";
import { V2Auth, V2AuthError } from "../src/gui-host/v2-auth.js";
import { isolatedMemoryEnv, TEST_PROJECT_ID } from "./helpers.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";

const request = (credential?: string) =>
  ({
    headers: credential ? { authorization: `Bearer ${credential}` } : {},
  }) as IncomingMessage;
const code = (expected: string) => (error: unknown) =>
  error instanceof V2AuthError && error.code === expected;
function fixture() {
  const f = isolatedMemoryEnv();
  f.env.A008_DEVICES_PATH = join(f.directory, "devices.sqlite");
  f.env.A008_PROJECTS_PATH = join(f.directory, "projects.json");
  return f;
}

test("actual local device CLI grants once, stores only hashes and observes expiry/revocation across reopen", () => {
  const f = fixture(),
    cli = fileURLToPath(
      new URL("../src/gui-host/device-cli.js", import.meta.url),
    );
  const run = (args: string[]) =>
    JSON.parse(
      execFileSync(process.execPath, [cli, ...args], {
        env: { ...process.env, ...f.env },
        encoding: "utf8",
      }),
    ) as any;
  try {
    const devices = new DeviceRegistry(f.env);
    assert.equal(devices.list().length, 0);
    assert.equal(existsSync(devices.path), false);
    const grant = run([
      "grant",
      "--name",
      "Fixture phone",
      "--project",
      TEST_PROJECT_ID,
      "--capability",
      "session",
    ]);
    assert.ok(
      typeof grant.credential === "string" &&
        /^a008_device_[A-Za-z0-9_-]{43}$/u.test(grant.credential),
    );
    assert.equal(
      grant.device.expiresAt - grant.device.createdAt,
      30 * 86_400_000,
    );
    assert.ok(
      !readFileSync(devices.path).includes(Buffer.from(grant.credential)),
    );
    assert.ok(!JSON.stringify(run(["list"])).includes(grant.credential));
    assert.ok(new DeviceRegistry(f.env).authenticate(grant.credential));
    assert.equal(
      new DeviceRegistry(f.env, () => grant.device.expiresAt).authenticate(
        grant.credential,
      ),
      undefined,
    );
    assert.equal(run(["revoke", grant.device.id]).revoked, true);
    assert.equal(devices.authenticate(grant.credential), undefined);
  } finally {
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("tickets enforce scope, expiry, one use, revocation, session validation and bounded allocation", () => {
  const f = fixture();
  let now = 1000;
  const devices = new DeviceRegistry(f.env, () => now);
  const auth = new V2Auth({
    devices,
    pin: createPinAuthGate(undefined),
    projectExists: (id) => id === TEST_PROJECT_ID,
    now: () => now,
  });
  try {
    assert.throws(() => auth.authenticate(request()), code("UNAUTHENTICATED"));
    const grant = devices.grant({
      name: "Fixture",
      projects: [TEST_PROJECT_ID],
      capabilities: ["session"],
    });
    const principal = auth.authenticate(request(grant.credential));
    assert.throws(
      () => auth.authorize(principal, TEST_PROJECT_ID, "shell"),
      code("FORBIDDEN"),
    );
    assert.throws(
      () =>
        auth.issue(principal, {
          projectId: "A008_v1_project_40000000-0000-4000-8000-000000000099",
        }),
      code("FORBIDDEN"),
    );
    assert.throws(
      () =>
        auth.issue(principal, {
          projectId: TEST_PROJECT_ID,
          sessionId: "foreign",
        }),
      code("SESSION_EXPIRED"),
    );
    const first = auth.issue(principal, { projectId: TEST_PROJECT_ID });
    assert.equal(auth.consume(first.ticket).principal.id, principal.id);
    assert.throws(() => auth.consume(first.ticket), code("UNAUTHENTICATED"));
    const expired = auth.issue(principal, { projectId: TEST_PROJECT_ID });
    now += 30_000;
    assert.throws(() => auth.consume(expired.ticket), code("UNAUTHENTICATED"));
    const revoked = auth.issue(principal, { projectId: TEST_PROJECT_ID });
    devices.revoke(principal.id);
    assert.throws(() => auth.consume(revoked.ticket), code("UNAUTHENTICATED"));
    const next = devices.grant({
      name: "Capacity fixture",
      projects: [TEST_PROJECT_ID],
      capabilities: ["session"],
    });
    const second = auth.authenticate(request(next.credential));
    for (let i = 0; i < 128; i++)
      auth.issue(second, { projectId: TEST_PROJECT_ID });
    assert.throws(
      () => auth.issue(second, { projectId: TEST_PROJECT_ID }),
      code("CAPACITY_EXCEEDED"),
    );
    now += 30_000;
    assert.ok(auth.issue(second, { projectId: TEST_PROJECT_ID }));
  } finally {
    auth.clear();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("real V2 discovery/ticket routes require app auth, registered scope and Origin while v1 stays available", async () => {
  const f = fixture();
  const created = executeProjectBootstrap(
    parseProjectBootstrapConfig({
      projectName: "Auth fixture",
      rootFolder: join(f.directory, "project"),
      repository: { initialize: false },
      continuity: { docsFirst: false, multiAgent: { enabled: false } },
      memory: { useGlobalA008Memory: false },
    }),
    { registryPath: f.env.A008_PROJECTS_PATH! },
  );
  const devices = new DeviceRegistry(f.env),
    projectId = created.project.projectId;
  const grant = devices.grant({
    name: "Host fixture",
    projects: [projectId],
    capabilities: ["session"],
  });
  const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
  const root = `http://127.0.0.1:${host.port}`;
  const ticket = (
    headers: Record<string, string>,
    payload: unknown = { projectId },
  ) =>
    fetch(`${root}/v2/auth/ticket`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
  try {
    const info = await (await fetch(`${root}/v2/info`)).json();
    const parsedInfo = v2InfoSchema.safeParse(info);
    assert.ok(parsedInfo.success);
    if (parsedInfo.success) {
      for (const feature of [
        "session.turn-identity",
        "session.message-identity",
        "session.event-sequence",
        "session.snapshot-boundary",
        "session.terminal-outcomes",
      ])
        assert.ok(parsedInfo.data.features.includes(feature));
      assert.equal(
        parsedInfo.data.features.includes("session.command-idempotency"),
        false,
      );
      assert.equal(
        parsedInfo.data.features.includes("session.reconnect-resume"),
        false,
      );
    }
    assert.ok(!JSON.stringify(info).includes(f.directory));
    assert.ok(!JSON.stringify(info).includes(projectId));
    assert.equal((await fetch(`${root}/v1/models`)).status, 200);
    const anonymous = await ticket({});
    assert.equal(anonymous.status, 401);
    assert.ok(v2ErrorSchema.safeParse(await anonymous.json()).success);
    const headers = { authorization: `Bearer ${grant.credential}` };
    assert.equal(
      (await ticket({ ...headers, origin: "https://untrusted.example" }))
        .status,
      403,
    );
    const allowed = await ticket(headers);
    assert.equal(allowed.status, 200);
    assert.ok(v2TicketResponseSchema.safeParse(await allowed.json()).success);
    assert.equal(
      (await ticket(headers, { projectId, sessionId: "missing" })).status,
      404,
    );
    devices.revoke(grant.device.id);
    assert.equal((await ticket(headers)).status, 401);
  } finally {
    await host.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

test("configured PIN cookie grants V2 owner profile; invalid Bearer never falls back to cookie", async () => {
  const f = fixture();
  const created = executeProjectBootstrap(
    parseProjectBootstrapConfig({
      projectName: "PIN fixture",
      rootFolder: join(f.directory, "project"),
      repository: { initialize: false },
      continuity: { docsFirst: false, multiAgent: { enabled: false } },
      memory: { useGlobalA008Memory: false },
    }),
    { registryPath: f.env.A008_PROJECTS_PATH! },
  );
  const host = await startGuiHost({
    env: f.env,
    port: 0,
    cwd: f.directory,
    pin: "123456",
  });
  const root = `http://127.0.0.1:${host.port}`;
  try {
    const login = await fetch(`${root}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: "123456" }),
    });
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const send = (authorization?: string) =>
      fetch(`${root}/v2/auth/ticket`, {
        method: "POST",
        headers: {
          cookie,
          "content-type": "application/json",
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify({ projectId: created.project.projectId }),
      });
    assert.equal((await send()).status, 200);
    assert.equal((await send("Bearer invalid")).status, 401);
  } finally {
    await host.close();
    rmSync(f.directory, { recursive: true, force: true });
  }
});

class V2WireClient {
  readonly frames: any[] = [];
  readonly #queue: any[] = [];
  readonly #waiters: Array<(frame: any) => void> = [];
  constructor(readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const frame = JSON.parse(String(event.data));
      assert.ok(
        v2SessionServerFrameSchema.safeParse(frame).success,
        `Invalid V2 server frame: ${JSON.stringify(frame)}`,
      );
      this.frames.push(frame);
      const waiter = this.#waiters.shift();
      if (waiter) waiter(frame);
      else this.#queue.push(frame);
    });
  }
  static async connect(port: number, ticket?: string): Promise<V2WireClient> {
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/v2/session`,
      "a008.v2",
    );
    const client = new V2WireClient(socket);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error("V2 WebSocket failed to open.")),
        { once: true },
      );
    });
    if (ticket) {
      client.send({ type: "authenticate", ticket });
      const authenticated = await client.next();
      assert.ok(
        v2SessionAuthenticatedSchema.safeParse(authenticated).success,
        JSON.stringify(authenticated),
      );
    }
    return client;
  }
  send(frame: unknown): void {
    this.socket.send(JSON.stringify(frame));
  }

  next(timeoutMs = 4000): Promise<any> {
    const queued = this.#queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for V2 frame.")),
        timeoutMs,
      );
      this.#waiters.push((frame) => {
        clearTimeout(timer);
        resolve(frame);
      });
    });
  }

  async until(
    type: string,
    requestId?: string,
    timeoutMs = 8000,
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const frame = await this.next(Math.max(1, deadline - Date.now()));
      if (
        frame.type === type &&
        (requestId === undefined || frame.requestId === requestId)
      )
        return frame;
    }
    throw new Error(`Timed out waiting for V2 ${type}.`);
  }

  close(): void {
    this.socket.close();
  }
}
async function issueV2Ticket(
  port: number,
  credential: string,
  projectId: string,
  sessionId?: string,
) {
  const response = await fetch(`http://127.0.0.1:${port}/v2/auth/ticket`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ projectId, ...(sessionId ? { sessionId } : {}) }),
  });
  const body = (await response.json()) as any;
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(
    v2TicketResponseSchema.safeParse(body).success,
    JSON.stringify(body),
  );
  return body.ticket as string;
}

function createRegisteredFixtureProject(
  f: ReturnType<typeof fixture>,
  name = "V2 fixture",
) {
  return executeProjectBootstrap(
    parseProjectBootstrapConfig({
      projectName: name,
      rootFolder: join(f.directory, name.replace(/\s+/gu, "-").toLowerCase()),
      repository: { initialize: false },
      continuity: { docsFirst: false, multiAgent: { enabled: false } },
      memory: { useGlobalA008Memory: false },
    }),
    { registryPath: f.env.A008_PROJECTS_PATH! },
  ).project;
}
test(
  "real V2 WebSocket authenticates once and runs project-bound session operations",
  { timeout: 30000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    f.env.PATH = process.env.PATH;
    const project = createRegisteredFixtureProject(f);
    const devices = new DeviceRegistry(f.env);
    const grant = devices.grant({
      name: "V2 client",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    let client: V2WireClient | undefined;
    try {
      const ticket = await issueV2Ticket(
        host.port,
        grant.credential,
        project.projectId,
      );
      client = await V2WireClient.connect(host.port, ticket);
      client.send({
        type: "command",
        requestId: "new_1",
        action: "session/new",
        projectId: project.projectId,
      });
      const opened = await client.until("result", "new_1");
      assert.ok(
        v2SessionResultSchema.safeParse(opened).success,
        JSON.stringify(opened),
      );
      assert.equal(opened.action, "session/new");
      assert.equal(opened.state.projectId, project.projectId);
      const sessionId = opened.sessionId as string;

      client.send({
        type: "command",
        requestId: "prompt_1",
        action: "session/prompt",
        projectId: project.projectId,
        sessionId,
        payload: { text: "Hello through V2" },
      });
      const result = await client.until("result", "prompt_1");
      assert.equal(result.state.messages.at(-1).role, "assistant");
      assert.match(result.state.messages.at(-1).content, /Fixture answer/u);
      assert.equal(result.state.messages.length, 2);
      assert.ok(
        result.state.messages.every((message: any) =>
          /^message_/u.test(message.messageId),
        ),
      );
      const turnEvents = client.frames.filter(
        (frame) => frame.type === "event" && frame.sessionId === sessionId,
      );
      assert.ok(turnEvents.some((frame) => frame.event === "answer/delta"));
      const started = turnEvents.find(
        (frame) => frame.event === "turn/started",
      );
      const terminal = turnEvents.find(
        (frame) => frame.event === "turn/terminal",
      );
      assert.ok(started);
      assert.equal(terminal?.turnId, started.turnId);
      assert.equal(terminal?.outcome, "completed");
      assert.equal(terminal?.answerStatus, "completed");
      assert.equal(terminal?.memoryStatus, "completed");
      assert.deepEqual(
        turnEvents.map((frame) => frame.sequence),
        turnEvents.map((_: any, index: number) => index + 1),
      );
      assert.ok(
        turnEvents.every(
          (frame) => frame.serverInstanceId === result.serverInstanceId,
        ),
      );
      const messageIds = result.state.messages.map(
        (message: any) => message.messageId,
      );

      client.send({
        type: "command",
        requestId: "inspect_1",
        action: "session/inspect",
        projectId: project.projectId,
        sessionId,
      });
      const inspected = await client.until("result", "inspect_1");
      assert.equal(inspected.state.messages.length, 2);
      assert.deepEqual(
        inspected.state.messages.map((message: any) => message.messageId),
        messageIds,
      );
      assert.equal(inspected.state.sequence, terminal.sequence);
    } finally {
      client?.close();
      await host.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
function waitForSocketClose(
  socket: WebSocket,
  timeoutMs = 7000,
): Promise<number> {
  if (socket.readyState === WebSocket.CLOSED) return Promise.resolve(1000);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for V2 socket close.")),
      timeoutMs,
    );
    socket.addEventListener(
      "close",
      (event) => {
        clearTimeout(timer);
        resolve(event.code);
      },
      { once: true },
    );
  });
}

async function expectV2Error(
  client: V2WireClient,
  codeValue: string,
  requestId?: string,
) {
  while (true) {
    const frame = await client.next();
    if (frame.type !== "error") continue;
    if (requestId !== undefined && frame.requestId !== requestId) continue;
    assert.ok(v2ErrorSchema.safeParse(frame).success, JSON.stringify(frame));
    assert.equal(frame.code, codeValue, JSON.stringify(frame));
    return frame;
  }
}
test(
  "V2 WebSocket enforces subprotocol, pre-auth deadline, frame bounds and ticket one-use",
  { timeout: 20000 },
  async () => {
    const f = fixture();
    const project = createRegisteredFixtureProject(f, "V2 limits");
    const devices = new DeviceRegistry(f.env);
    const grant = devices.grant({
      name: "Limits client",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    const clients: V2WireClient[] = [];
    try {
      const ticket = await issueV2Ticket(
        host.port,
        grant.credential,
        project.projectId,
      );
      const first = await V2WireClient.connect(host.port, ticket);
      clients.push(first);

      const reused = await V2WireClient.connect(host.port);
      clients.push(reused);
      reused.send({ type: "authenticate", ticket });
      await expectV2Error(reused, "UNAUTHENTICATED");
      await waitForSocketClose(reused.socket);

      const oversizedPreauth = await V2WireClient.connect(host.port);
      clients.push(oversizedPreauth);
      oversizedPreauth.socket.send("x".repeat(4097));
      await waitForSocketClose(oversizedPreauth.socket);

      const late = await V2WireClient.connect(host.port);
      clients.push(late);
      const lateFailure = await late.next(6500);
      assert.equal(lateFailure.type, "error");
      assert.equal(lateFailure.code, "UNAUTHENTICATED");
      await waitForSocketClose(late.socket);

      const secondTicket = await issueV2Ticket(
        host.port,
        grant.credential,
        project.projectId,
      );
      const oversizedAuthed = await V2WireClient.connect(
        host.port,
        secondTicket,
      );
      clients.push(oversizedAuthed);
      oversizedAuthed.socket.send("x".repeat(1_048_577));
      await waitForSocketClose(oversizedAuthed.socket);
    } finally {
      for (const client of clients) client.close();
      await host.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
test(
  "V2 session authority rejects foreign project, principal and second writer",
  { timeout: 20000 },
  async () => {
    const f = fixture();
    const projectA = createRegisteredFixtureProject(f, "Project A");
    const projectB = createRegisteredFixtureProject(f, "Project B");
    const devices = new DeviceRegistry(f.env);
    const owner = devices.grant({
      name: "Owner A",
      projects: [projectA.projectId, projectB.projectId],
      capabilities: ["session"],
    });
    const foreign = devices.grant({
      name: "Foreign A",
      projects: [projectA.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    const clients: V2WireClient[] = [];
    try {
      const ownerClient = await V2WireClient.connect(
        host.port,
        await issueV2Ticket(host.port, owner.credential, projectA.projectId),
      );
      clients.push(ownerClient);
      ownerClient.send({
        type: "command",
        requestId: "new_auth",
        action: "session/new",
        projectId: projectA.projectId,
      });
      const opened = await ownerClient.until("result", "new_auth");
      const sessionId = opened.sessionId as string;

      ownerClient.send({
        type: "command",
        requestId: "wrong_project",
        action: "session/inspect",
        projectId: projectB.projectId,
        sessionId,
      });
      await expectV2Error(ownerClient, "FORBIDDEN", "wrong_project");

      const foreignClient = await V2WireClient.connect(
        host.port,
        await issueV2Ticket(host.port, foreign.credential, projectA.projectId),
      );
      clients.push(foreignClient);
      foreignClient.send({
        type: "command",
        requestId: "foreign_session",
        action: "session/inspect",
        projectId: projectA.projectId,
        sessionId,
      });
      await expectV2Error(foreignClient, "SESSION_EXPIRED", "foreign_session");

      const scopedTicket = await issueV2Ticket(
        host.port,
        owner.credential,
        projectA.projectId,
        sessionId,
      );
      const secondWriter = await V2WireClient.connect(host.port, scopedTicket);
      clients.push(secondWriter);
      secondWriter.send({
        type: "command",
        requestId: "second_writer",
        action: "session/inspect",
        projectId: projectA.projectId,
        sessionId,
      });
      await expectV2Error(secondWriter, "SESSION_BUSY", "second_writer");
    } finally {
      for (const client of clients) client.close();
      await host.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
async function nextV2Signal(
  client: V2WireClient,
  signal: string,
  timeoutMs = 8000,
): Promise<any> {
  const event =
    signal === "thought"
      ? "thought/delta"
      : signal === "answer"
        ? "answer/delta"
        : signal;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = await client.next(Math.max(1, deadline - Date.now()));
    if (frame.type === "event" && frame.event === event) return frame;
  }
  throw new Error(`Timed out waiting for V2 event ${event}.`);
}

test(
  "V2 tool approval executes once and live revoke denies pending work",
  { timeout: 30000 },
  async () => {
    const provider = await startSessionControlProvider((payload) => {
      const messages = payload.messages ?? [];
      const last = messages.at(-1);
      if (last?.role === "tool")
        return { role: "assistant", content: "Tool phase finished." };
      const user =
        [...messages].reverse().find((message: any) => message.role === "user")
          ?.content ?? "";
      if (!String(user).includes("WRITE")) return undefined;
      const filename = String(user).includes("REVOKE")
        ? "revoked.txt"
        : String(user).includes("CANCEL")
          ? "cancelled.txt"
          : "approved.txt";
      return {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: `write-${filename}`,
            type: "function",
            function: {
              name: "create_file",
              arguments: JSON.stringify({ path: filename, content: filename }),
            },
          },
        ],
      };
    });
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    f.env.PATH = process.env.PATH;
    const project = createRegisteredFixtureProject(f, "V2 tools");
    const devices = new DeviceRegistry(f.env);
    const grant = devices.grant({
      name: "Tool client",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    let client: V2WireClient | undefined;
    try {
      client = await V2WireClient.connect(
        host.port,
        await issueV2Ticket(host.port, grant.credential, project.projectId),
      );
      client.send({
        type: "command",
        requestId: "new_tools",
        action: "session/new",
        projectId: project.projectId,
      });
      const sessionId = (await client.until("result", "new_tools"))
        .sessionId as string;

      client.send({
        type: "command",
        requestId: "prompt_allow",
        action: "session/prompt",
        projectId: project.projectId,
        sessionId,
        payload: { text: "WRITE APPROVE" },
      });
      const permission = await nextV2Signal(client, "tool/permission");
      assert.equal(existsSync(join(project.rootFolder, "approved.txt")), false);
      client.send({
        type: "command",
        requestId: "allow_1",
        action: "tool/permission",
        projectId: project.projectId,
        sessionId,
        payload: { permissionId: permission.permissionId, allow: true },
      });
      await client.until("result", "allow_1");
      await client.until("result", "prompt_allow");
      assert.equal(
        readFileSync(join(project.rootFolder, "approved.txt"), "utf8"),
        "approved.txt",
      );

      client.send({
        type: "command",
        requestId: "prompt_cancel_permission",
        action: "session/prompt",
        projectId: project.projectId,
        sessionId,
        payload: { text: "WRITE CANCEL" },
      });
      const cancelledPermission = await nextV2Signal(client, "tool/permission");
      assert.equal(
        existsSync(join(project.rootFolder, "cancelled.txt")),
        false,
      );
      client.send({
        type: "command",
        requestId: "cancel_permission_turn",
        action: "session/cancel",
        projectId: project.projectId,
        sessionId,
      });
      await client.until("result", "cancel_permission_turn");
      client.send({
        type: "command",
        requestId: "stale_permission",
        action: "tool/permission",
        projectId: project.projectId,
        sessionId,
        payload: {
          permissionId: cancelledPermission.permissionId,
          allow: true,
        },
      });
      let staleError: any;
      let cancelledPromptResult: any;
      const raceDeadline = Date.now() + 8000;
      while (
        (!staleError || !cancelledPromptResult) &&
        Date.now() < raceDeadline
      ) {
        const frame = await client.next(Math.max(1, raceDeadline - Date.now()));
        if (frame.type === "error" && frame.requestId === "stale_permission")
          staleError = frame;
        if (
          frame.type === "result" &&
          frame.requestId === "prompt_cancel_permission"
        )
          cancelledPromptResult = frame;
      }
      assert.equal(staleError?.code, "INVALID_REQUEST");
      assert.ok(cancelledPromptResult);
      assert.equal(
        existsSync(join(project.rootFolder, "cancelled.txt")),
        false,
      );
      const cancelledTerminals = client.frames.filter(
        (frame) =>
          frame.type === "event" &&
          frame.event === "turn/terminal" &&
          frame.turnId === cancelledPermission.turnId,
      );
      assert.equal(cancelledTerminals.length, 1);
      assert.equal(cancelledTerminals[0].outcome, "cancelled");

      client.send({
        type: "command",
        requestId: "prompt_revoke",
        action: "session/prompt",
        projectId: project.projectId,
        sessionId,
        payload: { text: "WRITE REVOKE" },
      });
      await nextV2Signal(client, "tool/permission");
      assert.equal(existsSync(join(project.rootFolder, "revoked.txt")), false);
      assert.equal(devices.revoke(grant.device.id), true);
      await waitForSocketClose(client.socket, 4000);
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(existsSync(join(project.rootFolder, "revoked.txt")), false);
    } finally {
      client?.close();
      await host.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
test(
  "V2 cancel and session/control dispatch through the shared session owner",
  { timeout: 20000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = fixture();
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    f.env.PATH = process.env.PATH;
    const project = createRegisteredFixtureProject(f, "V2 controls");
    const devices = new DeviceRegistry(f.env);
    const grant = devices.grant({
      name: "Control client",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    let client: V2WireClient | undefined;
    try {
      client = await V2WireClient.connect(
        host.port,
        await issueV2Ticket(host.port, grant.credential, project.projectId),
      );
      client.send({
        type: "command",
        requestId: "new_controls",
        action: "session/new",
        projectId: project.projectId,
      });
      const sessionId = (await client.until("result", "new_controls"))
        .sessionId as string;

      client.send({
        type: "command",
        requestId: "control_inspect",
        action: "session/control",
        projectId: project.projectId,
        sessionId,
        payload: { control: { action: "inspect" } },
      });
      const controlled = await client.until("result", "control_inspect");
      assert.equal(controlled.state.sessionId, sessionId);

      client.send({
        type: "command",
        requestId: "wait_prompt",
        action: "session/prompt",
        projectId: project.projectId,
        sessionId,
        payload: { text: "WAIT-TURN" },
      });
      await nextV2Signal(client, "thought");
      client.send({
        type: "command",
        requestId: "cancel_wait",
        action: "session/cancel",
        projectId: project.projectId,
        sessionId,
      });
      const cancelled = await client.until("result", "cancel_wait");
      assert.equal(cancelled.sessionId, sessionId);
      const promptResult =
        client.frames.find(
          (frame) =>
            frame.type === "result" && frame.requestId === "wait_prompt",
        ) ?? (await client.until("result", "wait_prompt"));
      assert.equal(promptResult.sessionId, sessionId);
      assert.equal(promptResult.state.active, false);
      const terminals = client.frames.filter(
        (frame) =>
          frame.type === "event" &&
          frame.event === "turn/terminal" &&
          frame.sessionId === sessionId,
      );
      assert.equal(terminals.length, 1);
      assert.equal(terminals[0].outcome, "cancelled");
      assert.equal(terminals[0].answerStatus, "cancelled");
    } finally {
      client?.close();
      await host.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
test(
  "V2 connection binding is transactional and fences concurrent session creation",
  { timeout: 15000 },
  async () => {
    const f = fixture();
    const project = createRegisteredFixtureProject(f, "V2 binding race");
    const devices = new DeviceRegistry(f.env);
    const grant = devices.grant({
      name: "Binding client",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    let client: V2WireClient | undefined;
    try {
      client = await V2WireClient.connect(
        host.port,
        await issueV2Ticket(host.port, grant.credential, project.projectId),
      );
      client.send({
        type: "command",
        requestId: "missing_first",
        action: "session/inspect",
        projectId: project.projectId,
        sessionId: "missing_session",
      });
      await expectV2Error(client, "SESSION_EXPIRED", "missing_first");

      client.send({
        type: "command",
        requestId: "race_a",
        action: "session/new",
        projectId: project.projectId,
      });
      client.send({
        type: "command",
        requestId: "race_b",
        action: "session/new",
        projectId: project.projectId,
      });
      const seen: any[] = [];
      while (
        !seen.some((frame) => frame.requestId === "race_a") ||
        !seen.some((frame) => frame.requestId === "race_b")
      )
        seen.push(await client.next());
      const raceFrames = seen.filter(
        (frame) => frame.requestId === "race_a" || frame.requestId === "race_b",
      );
      assert.equal(
        raceFrames.filter((frame) => frame.type === "result").length,
        1,
        JSON.stringify(raceFrames),
      );
      assert.equal(
        raceFrames.filter(
          (frame) => frame.type === "error" && frame.code === "SESSION_BUSY",
        ).length,
        1,
        JSON.stringify(raceFrames),
      );
    } finally {
      client?.close();
      await host.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
test(
  "V2 WebSocket rejects the wrong subprotocol on the real host",
  { timeout: 10000 },
  async () => {
    const f = fixture();
    createRegisteredFixtureProject(f, "V2 protocol");
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    try {
      await assert.rejects(
        new Promise<void>((resolve, reject) => {
          const socket = new WebSocket(
            `ws://127.0.0.1:${host.port}/v2/session`,
            "wrong.v2",
          );
          socket.addEventListener(
            "open",
            () => {
              socket.close();
              resolve();
            },
            { once: true },
          );
          socket.addEventListener(
            "error",
            () => reject(new Error("wrong subprotocol refused")),
            { once: true },
          );
        }),
        /wrong subprotocol refused/u,
      );
    } finally {
      await host.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "live V2 device expiry closes an authenticated socket",
  { timeout: 10000 },
  async () => {
    const f = fixture();
    const project = createRegisteredFixtureProject(f, "V2 expiry");
    const devices = new DeviceRegistry(f.env);
    const grant = devices.grant({
      name: "Expiry client",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    let client: V2WireClient | undefined;
    try {
      client = await V2WireClient.connect(
        host.port,
        await issueV2Ticket(host.port, grant.credential, project.projectId),
      );
      const db = new Database(devices.path);
      try {
        db.prepare("UPDATE devices SET expires = ? WHERE id = ?").run(
          Date.now() - 1,
          grant.device.id,
        );
      } finally {
        db.close();
      }
      await waitForSocketClose(client.socket, 4000);
    } finally {
      client?.close();
      await host.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
test(
  "V2 WebSocket output applies the existing credential redaction boundary",
  { timeout: 15000 },
  async () => {
    const secret = "synthetic-v2-wire-secret";
    const provider = await startSessionControlProvider(() => ({
      role: "assistant",
      content: `Never expose ${secret}.`,
    }));
    const f = fixture();
    f.env.NVIDIA_API_KEY = secret;
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    f.env.PATH = process.env.PATH;
    const project = createRegisteredFixtureProject(f, "V2 redaction");
    const devices = new DeviceRegistry(f.env);
    const grant = devices.grant({
      name: "Redaction client",
      projects: [project.projectId],
      capabilities: ["session"],
    });
    const host = await startGuiHost({ env: f.env, port: 0, cwd: f.directory });
    let client: V2WireClient | undefined;
    try {
      client = await V2WireClient.connect(
        host.port,
        await issueV2Ticket(host.port, grant.credential, project.projectId),
      );
      client.send({
        type: "command",
        requestId: "new_redact",
        action: "session/new",
        projectId: project.projectId,
      });
      const sessionId = (await client.until("result", "new_redact"))
        .sessionId as string;
      client.send({
        type: "command",
        requestId: "prompt_redact",
        action: "session/prompt",
        projectId: project.projectId,
        sessionId,
        payload: { text: "redact fixture" },
      });
      await client.until("result", "prompt_redact");
      const wire = JSON.stringify(client.frames);
      assert.equal(wire.includes(secret), false);
      assert.equal(wire.includes("[redacted]"), true);
    } finally {
      client?.close();
      await host.close();
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
