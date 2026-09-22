import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  bearerCredentials,
  cookieCredentials,
  createV2SessionClient,
  createPlatformV3Client,
  detectBrowserCredentials,
  engineCredentials,
  PlatformV3ClientError,
  V2ClientError,
  type ClientFetch,
  type ClientResponse,
  type PlatformV3RunCreateRequest,
} from "../packages/client/src/index.js";

function v3Response(body: unknown, status = 200): ClientResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => body,
  };
}

const v3Conversation = {
  id: "conversation_1",
  tenantId: "tenant_1",
  projectId: "project_1",
  title: "Platform V3",
  createdAt: 1,
  updatedAt: 1,
  revision: 0,
  messages: [],
};
const v3Run = {
  id: "run_1",
  tenantId: "tenant_1",
  projectId: "project_1",
  conversationId: "conversation_1",
  principalId: "principal_1",
  commandId: "command_1",
  model: "fixture-model",
  status: "queued",
  revision: 0,
  createdAt: 1,
  updatedAt: 1,
  leaseGeneration: 0,
  effectStatus: "none",
  answerStatus: "pending",
  memoryStatus: "not_requested",
};

test("cookie, bearer and engine adapters stay out of React and V2 URLs", () => {
  const cookie = cookieCredentials();
  assert.equal(cookie.kind, "cookie");
  assert.deepEqual(cookie.headers(), {});
  assert.equal(cookie.fetchCredentials(), "same-origin");
  assert.equal(
    cookie.applySocketUrl("ws://gui.test/v2/session"),
    "ws://gui.test/v2/session",
  );

  const bearer = bearerCredentials("a008_device_secret");
  assert.equal(bearer.headers().authorization, "Bearer a008_device_secret");
  assert.equal(
    bearer.applySocketUrl("ws://gui.test/v2/session"),
    "ws://gui.test/v2/session",
  );

  const engine = engineCredentials("ab".repeat(32));
  assert.equal(engine.headers().authorization, `Bearer ${"ab".repeat(32)}`);
  assert.match(engine.applySocketUrl("ws://gui.test/v1/session"), /access=/u);

  const detected = detectBrowserCredentials({
    hash: `#engine=${"cd".repeat(32)}`,
  });
  assert.equal(detected.kind, "engine");
  assert.equal(detectBrowserCredentials({ hash: "" }).kind, "cookie");
});

test("V2 client refuses to resubmit a mutation it already sent or after unknown outcome", async () => {
  const client = createV2SessionClient({
    origin: "http://127.0.0.1:9",
    projectId: "A008_v1_project_40000000-0000-4000-8000-000000000016",
    credentials: cookieCredentials(),
    fetch: async () => {
      throw new Error("fetch should not run");
    },
    webSocket: class {
      readonly url = "";
      readonly readyState = 3;
      send(): void {}
      close(): void {}
      addEventListener(): void {}
      removeEventListener(): void {}
    },
  });
  let first: unknown;
  try {
    await client.prompt("hello", "command_once");
  } catch (error) {
    first = error;
  }
  assert.ok(first instanceof V2ClientError);
  let second: unknown;
  try {
    await client.prompt("hello", "command_once");
  } catch (error) {
    second = error;
  }
  assert.ok(second instanceof V2ClientError);
  assert.equal((second as V2ClientError).code, "COMMAND_CONFLICT");
});

test("Platform V3 client validates every contract operation and preserves injected credentials", async () => {
  const responses = [
    { protocolVersion: "a008.platform.v3", available: false, capabilities: [] },
    { conversations: [v3Conversation] },
    { conversation: v3Conversation },
    { conversation: v3Conversation },
    { run: v3Run, replayed: false },
    { run: v3Run },
    { run: v3Run },
    { events: [], nextCursor: 1, hasMore: false },
  ];
  const calls: { url: string; init: Parameters<ClientFetch>[1] }[] = [];
  const fetch: ClientFetch = async (url, init) => {
    calls.push({ url, init });
    return v3Response(responses.shift());
  };
  const client = createPlatformV3Client({
    origin: "https://platform.example",
    credentials: bearerCredentials("sdk_secret"),
    fetch,
  });
  const controller = new AbortController();
  await client.info(controller.signal);
  await client.listConversations("project_1");
  await client.createConversation("project_1", { title: "Platform V3" });
  await client.getConversation("conversation_1");
  await client.createRun("conversation_1", {
    commandId: "command_1",
    expectedRevision: 0,
    model: "fixture-model",
    text: "hello",
  });
  await client.getRun("run_1");
  await client.cancelRun("run_1", { expectedRevision: 0 });
  await client.events({ projectId: "project_1", after: 0 });

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "https://platform.example/v3/info",
      "https://platform.example/v3/projects/project_1/conversations",
      "https://platform.example/v3/projects/project_1/conversations",
      "https://platform.example/v3/conversations/conversation_1",
      "https://platform.example/v3/conversations/conversation_1/runs",
      "https://platform.example/v3/runs/run_1",
      "https://platform.example/v3/runs/run_1/cancel",
      "https://platform.example/v3/events?projectId=project_1&limit=100&after=0",
    ],
  );
  assert.equal(calls[0]?.init?.signal, controller.signal);
  assert.equal(calls[0]?.init?.headers?.authorization, "Bearer sdk_secret");
  assert.ok(calls.every((call) => !call.url.includes("sdk_secret")));
  assert.equal(calls[2]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(calls[2]?.init?.body as string), {
    title: "Platform V3",
  });
  assert.deepEqual(JSON.parse(calls[4]?.init?.body as string), {
    commandId: "command_1",
    expectedRevision: 0,
    model: "fixture-model",
    text: "hello",
  });
  assert.equal("dispose" in client, false);

  let cookieInit: Parameters<ClientFetch>[1];
  await createPlatformV3Client({
    origin: "https://platform.example",
    credentials: cookieCredentials(),
    fetch: async (_url, init) => {
      cookieInit = init;
      return v3Response({
        protocolVersion: "a008.platform.v3",
        available: false,
        capabilities: [],
      });
    },
  }).info();
  assert.equal(cookieInit?.credentials, "same-origin");
});

test("Platform V3 client rejects malformed input before I/O and fences path traversal", async () => {
  let calls = 0;
  const client = createPlatformV3Client({
    origin: "https://platform.example",
    credentials: cookieCredentials(),
    fetch: async () => {
      calls += 1;
      return v3Response({});
    },
  });
  const invalidRun = {
    commandId: "command_1",
    expectedRevision: 0,
    model: "fixture-model",
    text: "hello",
    tenantId: "client-authority",
  } as unknown as PlatformV3RunCreateRequest;
  for (const operation of [
    () => client.getConversation(".."),
    () => client.createConversation(" ", { title: "Platform V3" }),
    () => client.createRun("conversation_1", invalidRun),
    () =>
      client.createRun("conversation_1", {
        commandId: " ",
        expectedRevision: 0,
        model: "fixture-model",
        text: "hello",
      }),
    () => client.events({ projectId: "project_1", limit: 1001 }),
    () => client.events({ projectId: " " }),
  ]) {
    await assert.rejects(
      async () => operation(),
      (error: unknown) => {
        return (
          error instanceof PlatformV3ClientError &&
          error.code === "INVALID_REQUEST"
        );
      },
    );
  }
  assert.equal(calls, 0);
});

test("Platform V3 client exposes server errors and never retries ambiguous transport failures", async () => {
  const server = createPlatformV3Client({
    origin: "https://platform.example",
    credentials: cookieCredentials(),
    fetch: async () =>
      v3Response(
        { error: { code: "REVISION_CONFLICT", message: "stale revision" } },
        409,
      ),
  });
  await assert.rejects(
    server.cancelRun("run_1", { expectedRevision: 0 }),
    (error: unknown) => {
      return (
        error instanceof PlatformV3ClientError &&
        error.code === "REVISION_CONFLICT" &&
        error.status === 409 &&
        error.message === "stale revision"
      );
    },
  );

  let attempts = 0;
  const transport = createPlatformV3Client({
    origin: "https://platform.example",
    credentials: cookieCredentials(),
    fetch: async () => {
      attempts += 1;
      throw new Error("network unavailable");
    },
  });
  await assert.rejects(
    transport.createRun("conversation_1", {
      commandId: "caller_retained_command",
      expectedRevision: 0,
      model: "fixture-model",
      text: "hello",
    }),
    (error: unknown) => {
      return (
        error instanceof PlatformV3ClientError &&
        error.code === "TRANSPORT_ERROR"
      );
    },
  );
  assert.equal(attempts, 1);

  const malformed = createPlatformV3Client({
    origin: "https://platform.example",
    credentials: cookieCredentials(),
    fetch: async () => v3Response({ run: { id: "foreign" } }),
  });
  await assert.rejects(malformed.getRun("run_1"), (error: unknown) => {
    return (
      error instanceof PlatformV3ClientError &&
      error.code === "INVALID_RESPONSE"
    );
  });
});

test("client package source stays platform-independent", () => {
  for (const name of readdirSync(resolve("packages/client/src"))) {
    if (!name.endsWith(".ts")) continue;
    const source = readFileSync(resolve("packages/client/src", name), "utf8");
    const imports = [
      ...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu),
    ].map((match) => match[1]!);
    assert.ok(
      imports.every(
        (value) => value.startsWith("./") || value === "@a008/protocol",
      ),
      `${name}: ${imports.join(", ")}`,
    );
    assert.doesNotMatch(
      source,
      /\b(?:process|window|localStorage|document)\./u,
    );
    assert.doesNotMatch(source, /from ["']react["']/u);
  }
});
