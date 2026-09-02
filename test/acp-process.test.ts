import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage } from "node:http";
import { once } from "node:events";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import * as acp from "@agentclientprotocol/sdk";
import { parseRuntimeId } from "../src/identity/runtime-id.js";
import { isolatedMemoryEnv, uniqueTraceFile } from "./helpers.js";

const ASSERTION =
  "Durable fact: the local memory project code is alpha-seven.";
const PROPOSITION = "the local memory project code is alpha-seven";

interface ProviderPayload {
  readonly model?: unknown;
  readonly stream?: unknown;
  readonly messages?: Array<{ readonly role?: unknown; readonly content?: unknown }>;
}

async function requestBody(request: IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) {
    body += chunk.toString();
  }
  return body;
}

function operationOf(payload: ProviderPayload): string | undefined {
  const last = payload.messages?.at(-1)?.content;
  if (typeof last !== "string") {
    return undefined;
  }
  try {
    const parsed = JSON.parse(last) as { readonly operation?: unknown };
    return typeof parsed.operation === "string" ? parsed.operation : undefined;
  } catch {
    return undefined;
  }
}

function writeSemantic(
  response: import("node:http").ServerResponse,
  content: unknown,
): void {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      choices: [
        {
          message: { role: "assistant", content: JSON.stringify(content) },
          finish_reason: "stop",
        },
      ],
    }),
  );
}

function writeChatSse(
  response: import("node:http").ServerResponse,
  reasoning: string,
  contentChunks: readonly string[],
): void {
  response.writeHead(200, { "content-type": "text/event-stream" });
  response.write(
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: reasoning } }] })}\n\n`,
  );
  contentChunks.forEach((chunk, index) => {
    response.write(
      `data: ${JSON.stringify({
        choices: [
          {
            delta: { content: chunk },
            finish_reason:
              index === contentChunks.length - 1 ? "stop" : undefined,
          },
        ],
      })}\n\n`,
    );
  });
  response.end("data: [DONE]\n\n");
}

test("compiled ACP process completes one turn through a local fake NVIDIA endpoint", async () => {
  const isolated = isolatedMemoryEnv();
  const payloads: ProviderPayload[] = [];
  let receivedAuthorization: string | undefined;
  const provider = createServer(async (request, response) => {
    receivedAuthorization = request.headers.authorization;
    const payload = JSON.parse(await requestBody(request)) as ProviderPayload;
    payloads.push(payload);
    const operation = operationOf(payload);
    if (payload.stream === false || operation !== undefined) {
      writeSemantic(response, operation === "relation_classification" ? { type: "new" } : []);
      return;
    }
    writeChatSse(response, "local thought", ["fake ", "answer"]);
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const address = provider.address();
  assert(address !== null && typeof address !== "string");

  const serverPath = fileURLToPath(
    new URL("../src/acp/server.js", import.meta.url),
  );
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ...isolated.env,
      NVIDIA_API_KEY: "local-test-key",
      NVIDIA_CHAT_COMPLETIONS_URL: `http://127.0.0.1:${address.port}/v1/chat/completions`,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert(child.stdin !== null && child.stdout !== null && child.stderr !== null);
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const updates: acp.SessionNotification[] = [];
  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
  );

  try {
    const result = await acp
      .client({ name: "a007-contract-test" })
      .onNotification("session/update", (context) => {
        updates.push(context.params);
      })
      .connectWith(stream, async (context) => {
        const initialized = await context.request("initialize", {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: { session: { configOptions: {} } },
        });
        assert.equal(initialized.agentInfo?.name, "a007");

        const created = await context.request("session/new", {
          cwd: process.cwd(),
          mcpServers: [],
        });
        assert.equal(
          parseRuntimeId(created.sessionId, "acp_session"),
          created.sessionId,
        );
        const configured = await context.request("session/set_config_option", {
          sessionId: created.sessionId,
          configId: "model",
          value: "nvidia/nemotron-3.5-lightning-30b-a3b",
        });
        const modelOption = configured.configOptions[0];
        assert(modelOption?.type === "select");
        assert.equal(
          modelOption.currentValue,
          "nvidia/nemotron-3.5-lightning-30b-a3b",
        );

        return await context.request("session/prompt", {
          sessionId: created.sessionId,
          prompt: [{ type: "text", text: "Hello from Agent Canvas" }],
        });
      });

    assert.equal(result.stopReason, "end_turn");
    assert.equal(receivedAuthorization, "Bearer local-test-key");
    const chat = payloads.find((payload) => operationOf(payload) === undefined);
    assert.equal(chat?.model, "nvidia/nemotron-3.5-lightning-30b-a3b");
    assert.match(String(chat?.messages?.at(-1)?.content), /Hello from Agent Canvas/u);
    assert.deepEqual(
      updates.map((notification) => notification.update),
      [
        {
          sessionUpdate: "agent_thought_chunk",
          content: { type: "text", text: "local thought" },
        },
        {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "fake " },
        },
        {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "answer" },
        },
      ],
    );
    assert.equal(stderr, "");
  } finally {
    child.stdin.end();
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    await new Promise<void>((resolve, reject) => {
      provider.close((error) =>
        error === undefined ? resolve() : reject(error),
      );
    });
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});

test("compiled ACP process commits a user assertion and rereads it on the next prompt", async () => {
  const isolated = isolatedMemoryEnv();
  const traceFile = uniqueTraceFile(isolated.directory);
  const payloads: ProviderPayload[] = [];
  const rawBodies: string[] = [];
  const provider = createServer(async (request, response) => {
    const raw = await requestBody(request);
    rawBodies.push(raw);
    const payload = JSON.parse(raw) as ProviderPayload;
    payloads.push(payload);
    const operation = operationOf(payload);
    if (payload.stream === false || operation !== undefined) {
      if (operation === "knowledge_analysis") {
        const last = payload.messages?.at(-1)?.content;
        const envelope =
          typeof last === "string"
            ? (JSON.parse(last) as { readonly input?: { readonly message?: unknown } })
            : undefined;
        writeSemantic(
          response,
          envelope?.input?.message === ASSERTION
            ? [
                {
                  proposition: PROPOSITION,
                  kind: "fact",
                  tags: ["memory"],
                  domains: ["runtime"],
                  entities: ["alpha-seven"],
                },
              ]
            : [],
        );
        return;
      }
      writeSemantic(response, { type: "new" });
      return;
    }
    const user = String(payload.messages?.at(-1)?.content ?? "");
    let projected = false;
    try {
      const envelope = JSON.parse(user) as {
        readonly retrievedContext?: { readonly items?: Array<{ readonly proposition?: unknown }> };
      };
      projected = (envelope.retrievedContext?.items ?? []).some(
        (item) => item.proposition === PROPOSITION,
      );
    } catch {
      projected = false;
    }
    writeChatSse(
      response,
      "private thought",
      [projected
        ? "The local memory project code is alpha-seven."
        : "Noted."],
    );
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const address = provider.address();
  assert(address !== null && typeof address !== "string");

  const serverPath = fileURLToPath(
    new URL("../src/acp/server.js", import.meta.url),
  );
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ...isolated.env,
      NVIDIA_API_KEY: "local-test-key",
      NVIDIA_CHAT_COMPLETIONS_URL: `http://127.0.0.1:${address.port}/v1/chat/completions`,
      A007_DEBUG_TRACE: "raw",
      A007_DEBUG_TRACE_FILE: traceFile,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert(child.stdin !== null && child.stdout !== null && child.stderr !== null);
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const updates: acp.SessionNotification[] = [];
  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
  );

  try {
    await acp
      .client({ name: "a007-memory-contract-test" })
      .onNotification("session/update", (context) => {
        updates.push(context.params);
      })
      .connectWith(stream, async (context) => {
        await context.request("initialize", {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientCapabilities: { session: { configOptions: {} } },
        });
        const created = await context.request("session/new", {
          cwd: process.cwd(),
          mcpServers: [],
        });
        await context.request("session/prompt", {
          sessionId: created.sessionId,
          prompt: [{ type: "text", text: ASSERTION }],
        });
        return await context.request("session/prompt", {
          sessionId: created.sessionId,
          prompt: [
            { type: "text", text: "What is the local memory project code?" },
          ],
        });
      });

    const chatPayloads = payloads.filter(
      (payload) => operationOf(payload) === undefined,
    );
    assert.equal(chatPayloads.length, 2);
    assert.match(String(chatPayloads[1]?.messages?.at(-1)?.content), new RegExp(PROPOSITION, "u"));
    assert.equal(String(chatPayloads[1]?.messages?.at(-1)?.content).includes("a007_v1_"), false);
    assert.match(
      updates.map((notification) => JSON.stringify(notification.update)).join("\n"),
      /alpha-seven/u,
    );
    assert.equal(stderr.includes("local-test-key"), false);
    const trace = readFileSync(traceFile, "utf8");
    assert.match(trace, /chat_request/u);
    assert.match(trace, /provider_http_response/u);
    assert.equal(trace.includes("local-test-key"), false);
    assert.equal(trace.includes("Bearer "), false);
  } finally {
    child.stdin.end();
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    await new Promise<void>((resolve, reject) => {
      provider.close((error) =>
        error === undefined ? resolve() : reject(error),
      );
    });
    rmSync(isolated.directory, { recursive: true, force: true });
  }
});
