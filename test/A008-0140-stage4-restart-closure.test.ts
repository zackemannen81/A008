import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { rmSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  v2ErrorSchema,
  v2InfoSchema,
  v2SessionAuthenticatedSchema,
  v2SessionServerFrameSchema,
} from "../packages/protocol/src/index.js";
import { executeProjectBootstrap } from "../src/bootstrap/service.js";
import { parseProjectBootstrapConfig } from "../src/bootstrap/validate.js";
import { DeviceRegistry } from "../src/gui-host/device-registry.js";
import { isolatedMemoryEnv } from "./helpers.js";
import { startSessionControlProvider } from "./fixtures/session-control-provider.js";

interface ChildHost {
  readonly child: ChildProcessWithoutNullStreams;
  readonly port: number;
  close(): Promise<void>;
}

class RestartV2Client {
  readonly frames: any[] = [];
  readonly #queue: any[] = [];
  readonly #waiters: Array<(frame: any) => void> = [];

  private constructor(readonly socket: WebSocket) {
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

  static async connect(port: number, ticket: string): Promise<RestartV2Client> {
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/v2/session`,
      "a008.v2",
    );
    const client = new RestartV2Client(socket);
    await Promise.race([
      onceWebSocket(socket, "open"),
      timeout(5_000, "Timed out opening V2 socket."),
    ]);
    client.send({ type: "authenticate", ticket });
    const authenticated = await client.next();
    assert.ok(
      v2SessionAuthenticatedSchema.safeParse(authenticated).success,
      JSON.stringify(authenticated),
    );
    return client;
  }

  send(frame: unknown): void {
    this.socket.send(JSON.stringify(frame));
  }

  next(timeoutMs = 5_000): Promise<any> {
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

  async until(type: string, requestId?: string, timeoutMs = 8_000) {
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

function onceWebSocket(socket: WebSocket, event: "open" | "close") {
  return new Promise<void>((resolve, reject) => {
    socket.addEventListener(event, () => resolve(), { once: true });
    if (event === "open")
      socket.addEventListener(
        "error",
        () => reject(new Error("V2 socket failed to open.")),
        { once: true },
      );
  });
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms),
  );
}

async function issueTicket(
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
    body: JSON.stringify({
      projectId,
      ...(sessionId ? { sessionId } : {}),
    }),
  });
  const body = (await response.json()) as any;
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.ticket as string;
}

async function startMemoryFailureProvider() {
  const requests: Record<string, any>[] = [];
  const server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += String(chunk);
    const payload = JSON.parse(text) as Record<string, any>;
    requests.push(payload);
    const last = payload.messages?.at(-1)?.content ?? "";
    let operation: string | undefined;
    try {
      operation = JSON.parse(last).operation;
    } catch {
      /* ordinary chat */
    }

    let message: Record<string, unknown>;
    if (operation === "retrieval_scope") {
      message = {
        role: "assistant",
        content: JSON.stringify({ domains: [], relatedDomains: [] }),
      };
    } else if (operation === "knowledge_analysis") {
      message = {
        role: "assistant",
        content: "{malformed-memory-analysis",
      };
    } else if (operation === "relation_classification") {
      message = {
        role: "assistant",
        content: JSON.stringify({ type: "new" }),
      };
    } else {
      message = {
        role: "assistant",
        content: "Answer survives memory failure.",
        reasoning_content: "Display-only fixture thought.",
      };
    }

    if (payload.stream === false) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          choices: [{ message, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      );
      return;
    }

    response.writeHead(200, { "content-type": "text/event-stream" });
    if (message.reasoning_content)
      response.write(
        `data: ${JSON.stringify({
          choices: [
            { delta: { reasoning_content: message.reasoning_content } },
          ],
        })}\n\n`,
      );
    response.write(
      `data: ${JSON.stringify({
        choices: [
          {
            delta: { content: message.content },
            finish_reason: "stop",
          },
        ],
      })}\n\n`,
    );
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Memory failure provider failed to bind.");
  return {
    requests,
    endpoint: `http://127.0.0.1:${address.port}/v1/chat/completions`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

async function startChildHost(env: NodeJS.ProcessEnv): Promise<ChildHost> {
  const serverPath = fileURLToPath(
    new URL("../src/gui-host/server.js", import.meta.url),
  );
  const child = spawn(
    process.execPath,
    [serverPath, "--host", "127.0.0.1", "--port", "0"],
    {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let stderr = "";
  const port = await Promise.race([
    new Promise<number>((resolve, reject) => {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
        const match =
          /A008-gui-host listening on http:\/\/127\.0\.0\.1:(\d+)/u.exec(
            stderr,
          );
        if (match?.[1]) resolve(Number(match[1]));
      });
      child.once("exit", (code) =>
        reject(
          new Error(
            `GUI host exited before listening (code ${String(code)}): ${stderr}`,
          ),
        ),
      );
    }),
    timeout(8_000, "Timed out starting child GUI host."),
  ]);
  return {
    child,
    port,
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill();
      await Promise.race([
        once(child, "exit").then(() => undefined),
        timeout(5_000, "Timed out stopping child GUI host."),
      ]);
    },
  };
}

test(
  "A008-0140 real process restart changes instance and makes old receipt/resume state explicitly unknown",
  { timeout: 30000 },
  async () => {
    const provider = await startSessionControlProvider();
    const f = isolatedMemoryEnv();
    f.env.A008_DEVICES_PATH = join(f.directory, "devices.sqlite");
    f.env.A008_PROJECTS_PATH = join(f.directory, "projects.json");
    f.env.A008_CATALOG_PATH = join(f.directory, "catalog.json");
    f.env.A008_SECRETS_PATH = join(f.directory, "secrets.json");
    f.env.A008_GUI_WORKSPACE = f.directory;
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    f.env.PATH = process.env.PATH;

    const project = executeProjectBootstrap(
      parseProjectBootstrapConfig({
        projectName: "Restart uncertainty",
        rootFolder: join(f.directory, "project"),
        repository: { initialize: false },
        continuity: { docsFirst: false, multiAgent: { enabled: false } },
        memory: { useGlobalA008Memory: false },
      }),
      { registryPath: f.env.A008_PROJECTS_PATH },
    ).project;
    const grant = new DeviceRegistry(f.env).grant({
      name: "Restart client",
      projects: [project.projectId],
      capabilities: ["session"],
    });

    let first: ChildHost | undefined;
    let second: ChildHost | undefined;
    let client: RestartV2Client | undefined;
    let nextClient: RestartV2Client | undefined;
    try {
      first = await startChildHost(f.env);
      const firstInfoResponse = await fetch(
        `http://127.0.0.1:${first.port}/v2/info`,
      );
      const firstInfo = v2InfoSchema.parse(await firstInfoResponse.json());
      assert.ok(firstInfo.features.includes("session.restart-uncertainty"));

      client = await RestartV2Client.connect(
        first.port,
        await issueTicket(first.port, grant.credential, project.projectId),
      );
      client.send({
        type: "command",
        requestId: "restart_new",
        commandId: "restart_new_command",
        action: "session/new",
        projectId: project.projectId,
      });
      const opened = await client.until("result", "restart_new");
      const sessionId = opened.sessionId as string;
      const resumeCapability = opened.resumeCapability as string;

      client.send({
        type: "command",
        requestId: "restart_prompt",
        commandId: "restart_prompt_command",
        action: "session/prompt",
        projectId: project.projectId,
        sessionId,
        payload: { text: "WAIT-TURN" },
      });
      const eventDeadline = Date.now() + 8_000;
      let thoughtObserved = false;
      while (Date.now() < eventDeadline && !thoughtObserved) {
        const frame = await client.next(
          Math.max(1, eventDeadline - Date.now()),
        );
        thoughtObserved =
          frame.type === "event" && frame.event === "thought/delta";
      }
      assert.equal(thoughtObserved, true);
      const runningResponse = await fetch(
        `http://127.0.0.1:${first.port}/v2/projects/${project.projectId}/commands/restart_prompt_command`,
        { headers: { authorization: `Bearer ${grant.credential}` } },
      );
      const runningReceipt = (await runningResponse.json()) as any;
      assert.equal(runningResponse.status, 200, JSON.stringify(runningReceipt));
      assert.equal(runningReceipt.status, "running");
      assert.equal(runningReceipt.serverInstanceId, firstInfo.serverInstanceId);
      const providerCallsBeforeRestart = provider.requests.filter(
        (payload) =>
          !String(payload.messages?.at(-1)?.content ?? "").includes(
            '"operation"',
          ),
      ).length;
      assert.equal(providerCallsBeforeRestart, 1);

      first.child.kill();
      await once(first.child, "exit");
      first = undefined;

      second = await startChildHost(f.env);
      const secondInfoResponse = await fetch(
        `http://127.0.0.1:${second.port}/v2/info`,
      );
      const secondInfo = v2InfoSchema.parse(await secondInfoResponse.json());
      assert.notEqual(secondInfo.serverInstanceId, firstInfo.serverInstanceId);

      const lostReceiptResponse = await fetch(
        `http://127.0.0.1:${second.port}/v2/projects/${project.projectId}/commands/restart_prompt_command`,
        { headers: { authorization: `Bearer ${grant.credential}` } },
      );
      const lostReceipt = await lostReceiptResponse.json();
      assert.equal(lostReceiptResponse.status, 404);
      assert.ok(v2ErrorSchema.safeParse(lostReceipt).success);
      assert.equal((lostReceipt as any).code, "COMMAND_UNKNOWN");
      assert.equal(
        (lostReceipt as any).serverInstanceId,
        secondInfo.serverInstanceId,
      );

      const oldSessionTicketResponse = await fetch(
        `http://127.0.0.1:${second.port}/v2/auth/ticket`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${grant.credential}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            projectId: project.projectId,
            sessionId,
          }),
        },
      );
      const oldSessionTicketBody = await oldSessionTicketResponse.json();
      assert.equal(oldSessionTicketResponse.status, 404);
      assert.equal((oldSessionTicketBody as any).code, "SESSION_EXPIRED");

      nextClient = await RestartV2Client.connect(
        second.port,
        await issueTicket(second.port, grant.credential, project.projectId),
      );
      nextClient.send({
        type: "command",
        requestId: "restart_resume",
        commandId: "restart_resume_command",
        action: "session/resume",
        projectId: project.projectId,
        sessionId,
        payload: { resumeCapability },
      });
      const resumeFailure = await nextClient.until("error", "restart_resume");
      assert.equal(resumeFailure.code, "SESSION_EXPIRED");
      assert.equal(resumeFailure.serverInstanceId, secondInfo.serverInstanceId);

      const providerCallsAfterRestart = provider.requests.filter(
        (payload) =>
          !String(payload.messages?.at(-1)?.content ?? "").includes(
            '"operation"',
          ),
      ).length;
      assert.equal(providerCallsAfterRestart, providerCallsBeforeRestart);
    } finally {
      client?.close();
      nextClient?.close();
      await first?.close().catch(() => undefined);
      await second?.close().catch(() => undefined);
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);

test(
  "A008-0140 completed answer reports post-output memory failure independently",
  { timeout: 20000 },
  async () => {
    const provider = await startMemoryFailureProvider();
    const f = isolatedMemoryEnv();
    f.env.A008_DEVICES_PATH = join(f.directory, "devices.sqlite");
    f.env.A008_PROJECTS_PATH = join(f.directory, "projects.json");
    f.env.A008_CATALOG_PATH = join(f.directory, "catalog.json");
    f.env.A008_SECRETS_PATH = join(f.directory, "secrets.json");
    f.env.A008_GUI_WORKSPACE = f.directory;
    f.env.NVIDIA_CHAT_COMPLETIONS_URL = provider.endpoint;
    f.env.PATH = process.env.PATH;

    const project = executeProjectBootstrap(
      parseProjectBootstrapConfig({
        projectName: "Partial memory outcome",
        rootFolder: join(f.directory, "project"),
        repository: { initialize: false },
        continuity: { docsFirst: false, multiAgent: { enabled: false } },
        memory: { useGlobalA008Memory: false },
      }),
      { registryPath: f.env.A008_PROJECTS_PATH },
    ).project;
    const grant = new DeviceRegistry(f.env).grant({
      name: "Partial-memory client",
      projects: [project.projectId],
      capabilities: ["session"],
    });

    let host: ChildHost | undefined;
    let client: RestartV2Client | undefined;
    try {
      host = await startChildHost(f.env);
      client = await RestartV2Client.connect(
        host.port,
        await issueTicket(host.port, grant.credential, project.projectId),
      );
      client.send({
        type: "command",
        requestId: "memory_new",
        commandId: "memory_new_command",
        action: "session/new",
        projectId: project.projectId,
      });
      const opened = await client.until("result", "memory_new");
      const sessionId = opened.sessionId as string;

      client.send({
        type: "command",
        requestId: "memory_prompt",
        commandId: "memory_prompt_command",
        action: "session/prompt",
        projectId: project.projectId,
        sessionId,
        payload: { text: "ANSWER DESPITE MEMORY FAILURE" },
      });
      const result = await client.until("result", "memory_prompt", 12_000);
      assert.equal(result.state.active, false);
      assert.equal(
        result.state.messages.at(-1)?.content,
        "Answer survives memory failure.",
      );
      const terminals = client.frames.filter(
        (frame) =>
          frame.type === "event" &&
          frame.event === "turn/terminal" &&
          frame.sessionId === sessionId,
      );
      assert.equal(terminals.length, 1);
      assert.equal(terminals[0].outcome, "completed");
      assert.equal(terminals[0].answerStatus, "completed");
      assert.equal(terminals[0].memoryStatus, "staging_failed");
      assert.ok(
        provider.requests.some((payload) =>
          String(payload.messages?.at(-1)?.content ?? "").includes(
            '"operation":"knowledge_analysis"',
          ),
        ),
      );
    } finally {
      client?.close();
      await host?.close().catch(() => undefined);
      await provider.close();
      rmSync(f.directory, { recursive: true, force: true });
    }
  },
);
