import assert from "node:assert/strict";
import test from "node:test";
import {
  PROTOCOL_VERSION,
  RequestError,
  type NewSessionRequest,
} from "@agentclientprotocol/sdk";
import { A008AcpAgent } from "../src/acp/A008-acp-agent.js";
import { ChatSession } from "../src/core/chat-session.js";
import { ChatError } from "../src/core/errors.js";
import type {
  ChatRequest,
  ChatTransport,
} from "../src/core/types.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";

const NEW_SESSION: NewSessionRequest = {
  cwd: "C:\\workspace",
  mcpServers: [],
};
const SESSION_ID =
  "A008_v1_acp_session_00000000-0000-4000-8000-000000000001";

test("ACP agent advertises stable v1 and the verified model", () => {
  const agent = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
    createSessionId: () => SESSION_ID,
  });

  const initialized = agent.initialize({ protocolVersion: PROTOCOL_VERSION });
  const created = agent.newSession(NEW_SESSION);

  assert.equal(initialized.protocolVersion, PROTOCOL_VERSION);
  assert.equal(initialized.agentInfo?.name, "A008");
  assert.equal(initialized.agentCapabilities?.loadSession, false);
  assert.equal(created.sessionId, SESSION_ID);
  assert.deepEqual(created.configOptions?.[0], {
    type: "select",
    id: "model",
    name: "Model",
    description: "Provider model used by the shared A008 chat core.",
    category: "model",
    currentValue: "nvidia/nemotron-3.5-lightning-30b-a3b",
    options: [
      {
        value: "nvidia/nemotron-3.5-lightning-30b-a3b",
        name: "NVIDIA Nemotron 3.5 Lightning 30B A3B",
      },
    ],
  });
});

test("ACP prompt streams thought and answer through one ChatSession", async () => {
  let request: ChatRequest | undefined;
  const transport: ChatTransport = {
    async complete(input, callbacks) {
      request = input;
      callbacks?.onDelta?.({ type: "reasoning", text: "thinking" });
      callbacks?.onDelta?.({ type: "content", text: "hello" });
      return {
        message: { role: "assistant", content: "hello world" },
        reasoning: "thinking",
        usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
      };
    },
  };
  const session = new ChatSession({ model: "model", transport });
  const agent = new A008AcpAgent({
    createSession: () => session,
    createSessionId: () => SESSION_ID,
  });
  agent.newSession(NEW_SESSION);
  const notifications: unknown[] = [];

  const result = await agent.prompt(
    {
      sessionId: SESSION_ID,
      prompt: [
        { type: "text", text: "question" },
        {
          type: "resource_link",
          name: "context",
          uri: "file:///workspace/context.md",
        },
      ],
    },
    async (notification) => {
      notifications.push(notification);
    },
  );

  assert.equal(result.stopReason, "end_turn");
  assert.deepEqual(result.usage, {
    inputTokens: 3,
    outputTokens: 2,
    totalTokens: 5,
  });
  assert.equal(
    request?.messages.at(-1)?.content,
    "question\n\n[context](file:///workspace/context.md)",
  );
  assert.deepEqual(
    notifications.map((value) =>
      (value as { update: { sessionUpdate: string; content: { text: string } } })
        .update,
    ),
    [
      {
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "thinking" },
      },
      {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "hello" },
      },
      {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: " world" },
      },
    ],
  );
});

test("ACP agent rejects unknown sessions, unsupported content, and models", async () => {
  const agent = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
    createSessionId: () => SESSION_ID,
  });
  agent.newSession(NEW_SESSION);

  await assert.rejects(
    agent.prompt(
      { sessionId: "missing", prompt: [{ type: "text", text: "hi" }] },
      async () => undefined,
    ),
    (error: unknown) => error instanceof RequestError && error.code === -32602,
  );
  await assert.rejects(
    agent.prompt(
      {
        sessionId: SESSION_ID,
        prompt: [{ type: "image", data: "AA==", mimeType: "image/png" }],
      },
      async () => undefined,
    ),
    (error: unknown) => error instanceof RequestError && error.code === -32602,
  );
  assert.throws(
    () =>
      agent.setSessionConfigOption({
        sessionId: SESSION_ID,
        configId: "model",
        value: "unknown/model",
      }),
    (error: unknown) => error instanceof RequestError && error.code === -32602,
  );
});

test("ACP cancellation rolls back the pending ChatSession turn", async () => {
  let session: ChatSession | undefined;
  const transport: ChatTransport = {
    async complete(request) {
      return await new Promise((_, reject) => {
        request.signal?.addEventListener(
          "abort",
          () => reject(new ChatError("cancelled", "cancelled")),
          { once: true },
        );
      });
    },
  };
  const agent = new A008AcpAgent({
    createSession: () => {
      session = new ChatSession({ model: "model", transport });
      return session;
    },
    createSessionId: () => SESSION_ID,
  });
  agent.newSession(NEW_SESSION);

  const pending = agent.prompt(
    { sessionId: SESSION_ID, prompt: [{ type: "text", text: "wait" }] },
    async () => undefined,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  agent.cancel({ sessionId: SESSION_ID });

  assert.deepEqual(await pending, { stopReason: "cancelled" });
  assert.deepEqual(session?.messages, []);
});

test("ACP default session identity is canonical", () => {
  const agent = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
  });

  const created = agent.newSession(NEW_SESSION);
  assert.equal(parseRuntimeId(created.sessionId, "acp_session"), created.sessionId);
});

test("ACP rejects malformed and duplicate injected session identities", () => {
  const malformed = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
    createSessionId: () => "session-1",
  });
  assert.throws(
    () => malformed.newSession(NEW_SESSION),
    (error: unknown) => error instanceof RequestError && error.code === -32602,
  );

  const duplicate = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
    createSessionId: () => SESSION_ID,
  });
  assert.equal(duplicate.newSession(NEW_SESSION).sessionId, SESSION_ID);
  assert.throws(
    () => duplicate.newSession(NEW_SESSION),
    (error: unknown) => error instanceof RequestError && error.code === -32602,
  );
});
