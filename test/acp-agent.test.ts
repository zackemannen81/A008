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
import type { ChatRequest, ChatTransport } from "../src/core/types.js";
import { parseRuntimeId } from "../src/identity/runtime-id.js";

const NEW_SESSION: NewSessionRequest = {
  cwd: "C:\\workspace",
  mcpServers: [],
};
const SESSION_ID = "A008_v1_acp_session_00000000-0000-4000-8000-000000000001";

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
  // The option is a select over every registered model, so this asserts its
  // shape and the default rather than a fixed list that grows with the registry.
  const option = created.configOptions?.[0];
  assert.equal(option?.type, "select");
  assert.equal(option?.id, "model");
  assert.equal(option?.name, "Model");
  assert.equal(
    option?.currentValue,
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "the default stays the text-only verified profile",
  );
  assert.ok(
    option?.options?.some(
      (entry) =>
        "value" in entry &&
        entry.value === "nvidia/nemotron-3.5-lightning-30b-a3b",
    ),
    "the default model is selectable",
  );
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
    notifications.map(
      (value) =>
        (
          value as {
            update: { sessionUpdate: string; content: { text: string } };
          }
        ).update,
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

test("ACP session/close releases only the session it names", () => {
  let next = 0;
  const ids = [
    SESSION_ID,
    "A008_v1_acp_session_00000000-0000-4000-8000-000000000002",
  ] as const;
  const agent = new A008AcpAgent({
    createSession: () =>
      new ChatSession({
        model: "model",
        transport: {
          async complete() {
            throw new Error("not needed");
          },
        },
      }),
    createSessionId: () => {
      const id = ids[next];
      next += 1;
      return id ?? SESSION_ID;
    },
  });
  agent.newSession(NEW_SESSION);
  agent.newSession(NEW_SESSION);
  assert.deepEqual([...agent.openSessionIds()].sort(), [...ids].sort());

  assert.deepEqual(agent.closeSession({ sessionId: ids[0] }), {});

  assert.deepEqual(agent.openSessionIds(), [ids[1]]);
});

test("ACP session/close fails closed on an unknown or already-closed session", () => {
  const agent = new A008AcpAgent({
    createSession: () =>
      new ChatSession({
        model: "model",
        transport: {
          async complete() {
            throw new Error("not needed");
          },
        },
      }),
    createSessionId: () => SESSION_ID,
  });
  agent.newSession(NEW_SESSION);

  agent.closeSession({ sessionId: SESSION_ID });
  assert.deepEqual(agent.openSessionIds(), []);

  // A double close and a session this agent never held are the same condition:
  // the agent does not hold it now.
  assert.throws(() => agent.closeSession({ sessionId: SESSION_ID }));
  assert.throws(() =>
    agent.closeSession({
      sessionId: "A008_v1_acp_session_00000000-0000-4000-8000-000000000009",
    }),
  );
});

test("ACP session/close aborts the turn in flight on that session", async () => {
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

  agent.closeSession({ sessionId: SESSION_ID });

  assert.deepEqual(await pending, { stopReason: "cancelled" });
  assert.deepEqual(session?.messages, [], "a released turn must not commit");
  assert.deepEqual(agent.openSessionIds(), []);
});

test("ACP session/close support is advertised without changing the old contract", () => {
  const agent = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
    createSessionId: () => SESSION_ID,
  });

  const initialized = agent.initialize({ protocolVersion: PROTOCOL_VERSION });

  // Present for a client that looks for it...
  assert.ok(initialized.agentCapabilities?.sessionCapabilities?.close);
  // ...and every field an existing client already reads is untouched.
  assert.equal(initialized.protocolVersion, PROTOCOL_VERSION);
  assert.equal(initialized.agentCapabilities?.loadSession, false);
  assert.deepEqual(initialized.agentCapabilities?.promptCapabilities, {
    image: false,
    audio: false,
    embeddedContext: false,
  });
  assert.equal(initialized.agentInfo?.name, "A008");
});

test("ACP default session identity is canonical", () => {
  const agent = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
  });

  const created = agent.newSession(NEW_SESSION);
  assert.equal(
    parseRuntimeId(created.sessionId, "acp_session"),
    created.sessionId,
  );
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

test("ACP exposes A007_MEMORY_V1 only when a real memory surface is composed", async () => {
  const agent = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
    sharedMemoryCapabilities: () => ({
      protocol: "A007_MEMORY_V1",
      version: 1,
      capabilities: ["recall", "write", "durable", "provenance"],
      projectId: "A008_v1_project_40000000-0000-4000-8000-000000000028",
      durable: true,
      writeSemantics: "evidence",
    }),
    recallSharedMemory: async (params) => ({
      items: [
        {
          id: "utterance:0",
          content: params.query,
          kind: "utterance",
          score: 0.2,
          tags: [...(params.scopes ?? [])],
          scope: [],
          provenance: ["a008:memory"],
          metadata: {
            authority: 0.2,
            identityKind: "projection",
            projectId: "A008_v1_project_40000000-0000-4000-8000-000000000028",
          },
        },
      ],
      omitted: 0,
      measuredUnits: 10,
      measurementUnit: "utf8_bytes",
    }),
    writeSharedMemory: async () => ({
      id: "A008_knowledge_utterance_test",
      artifactId: "A008_knowledge_artifact_test",
      status: "STORED",
      durable: true,
      semantics: "evidence",
    }),
  });

  const capabilities = await agent.sharedMemoryCapabilities({
    protocol: "A007_MEMORY_V1",
    version: 1,
  });
  assert.ok(capabilities.capabilities.includes("recall"));
  assert.equal(capabilities.writeSemantics, "evidence");

  const recalled = await agent.recallMemory({
    query: "  external memory query  ",
    limit: 3,
    scopes: ["project"],
  });
  assert.equal(recalled.items[0]?.content, "external memory query");
  assert.deepEqual(recalled.items[0]?.tags, ["project"]);

  const written = await agent.writeMemory({
    content: "  external memory fact  ",
  });
  assert.equal(written.status, "STORED");
  assert.equal(written.semantics, "evidence");

  await assert.rejects(
    () => agent.sharedMemoryCapabilities({ protocol: "wrong", version: 1 }),
    /A007_MEMORY_V1/u,
  );
});

test("ACP memory methods fail closed when no memory runtime was composed", async () => {
  const agent = new A008AcpAgent({
    createSession: () => {
      throw new Error("not needed");
    },
  });
  await assert.rejects(
    () =>
      agent.sharedMemoryCapabilities({
        protocol: "A007_MEMORY_V1",
        version: 1,
      }),
    /method/i,
  );
  await assert.rejects(
    () => agent.recallMemory({ query: "anything" }),
    /method/i,
  );
  await assert.rejects(
    () => agent.writeMemory({ content: "anything" }),
    /method/i,
  );
});

test("ACP native source image is capability-gated and stays invocation-local", async () => {
  let captured: ChatRequest | undefined;
  let created: ChatSession | undefined;
  const agent = new A008AcpAgent({
    createSession(model) {
      created = new ChatSession({
        model,
        transport: {
          async complete(request) {
            captured = request;
            return { message: { role: "assistant", content: "a cat" } };
          },
        },
      });
      return created;
    },
    resolveImageAttachment(locator) {
      assert.match(locator, /^source:/u);
      return { mediaType: "image/png", dataRef: "data:image/png;base64,AAAA" };
    },
    createSessionId: () => SESSION_ID,
  });
  agent.newSession(NEW_SESSION);
  agent.setSessionConfigOption({
    sessionId: SESSION_ID,
    configId: "model",
    value: "moonshotai/kimi-k3",
  });
  await agent.prompt(
    {
      sessionId: SESSION_ID,
      prompt: [
        { type: "text", text: "what is shown?" },
        {
          type: "resource_link",
          name: "chat-image",
          uri: `source:${"a".repeat(64)}/photo.png`,
          mimeType: "image/png",
        },
      ],
    },
    async () => undefined,
  );
  assert.deepEqual(captured?.imageAttachments, [
    { mediaType: "image/png", dataRef: "data:image/png;base64,AAAA" },
  ]);
  assert.equal(captured?.messages.at(-1)?.content, "what is shown?");
  assert.deepEqual(created?.messages, [
    { role: "user", content: "what is shown?" },
    { role: "assistant", content: "a cat" },
  ]);

  const textOnlyId = "A008_v1_acp_session_00000000-0000-4000-8000-000000000002";
  const blocked = new A008AcpAgent({
    createSession() {
      throw new Error("provider must not be reached");
    },
    resolveImageAttachment() {
      throw new Error("resolver must not run for unsupported model");
    },
    createSessionId: () => textOnlyId,
  });
  blocked.newSession(NEW_SESSION);
  await assert.rejects(
    blocked.prompt(
      {
        sessionId: textOnlyId,
        prompt: [
          { type: "text", text: "look" },
          {
            type: "resource_link",
            name: "chat-image",
            uri: `source:${"b".repeat(64)}/photo.png`,
            mimeType: "image/png",
          },
        ],
      },
      async () => undefined,
    ),
    (error: unknown) =>
      error instanceof RequestError &&
      /does not declare image input support/u.test(error.message),
  );
});
