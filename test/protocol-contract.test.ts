import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  clientMessageSchema,
  hostServerMessageSchema,
  serverMessageSchema,
  parseServerMessage,
  isRuntimePreferencesSnapshot,
  v1JsonSchemas,
  v1HttpRoutes,
  chatContentSchema,
  platformV3ConversationMessageSchema,
  platformV3ConversationSchema,
  platformV3EventsQuerySchema,
  platformV3JsonSchemas,
  platformV3OpenApiDocument,
  platformV3RunCreateRequestSchema,
} from "../packages/protocol/src/index.js";
import { parseClientMessage } from "../src/gui-host/protocol.js";

const fixtures = JSON.parse(
  readFileSync(
    resolve("packages/protocol/fixtures/v1-compatibility.json"),
    "utf8",
  ),
) as {
  client: { raw: string; value?: unknown; error?: string; name?: string }[];
  server: { raw: unknown; value?: unknown; error?: string; name?: string }[];
};
function capture(operation: () => unknown) {
  try {
    return { value: operation() ?? null };
  } catch (error) {
    return { error: (error as Error).message, name: (error as Error).name };
  }
}
test("shared v1 parsers preserve all frozen legacy acceptance and error cases", () => {
  for (const { raw, ...expected } of fixtures.client) {
    assert.deepEqual(
      capture(() => parseClientMessage(raw)),
      expected,
      raw,
    );
    const parsed = parseClientMessage(raw);
    if (!("error" in parsed))
      assert.equal(clientMessageSchema.safeParse(parsed).success, true, raw);
  }
  for (const { raw, ...expected } of fixtures.server) {
    assert.deepEqual(
      capture(() => parseServerMessage(raw)),
      expected,
      JSON.stringify(raw),
    );
    if (expected.value)
      assert.equal(
        serverMessageSchema.safeParse(expected.value).success,
        true,
        JSON.stringify(raw),
      );
  }
});
test("v1 distinguishes current host output from accepted older replies and preserves additive snapshots", () => {
  const old = { type: "session/new/ok", requestId: "r", sessionId: "s" };
  assert.equal(serverMessageSchema.safeParse(old).success, true);
  assert.equal(hostServerMessageSchema.safeParse(old).success, false);
  assert.equal(
    hostServerMessageSchema.safeParse({ ...old, resumeToken: "a".repeat(64) })
      .success,
    true,
  );
  assert.equal(
    parseServerMessage({ type: "future/addition", field: "value" }),
    undefined,
  );
  const settings = {
    instructions: "",
    budgets: { x: 2 },
    memoryLifecycle: { future: true },
  };
  const prefs = {
    revision: "r",
    settings,
    defaults: settings,
    storagePath: null,
    fields: [
      {
        key: "x",
        label: "x",
        unit: "n",
        description: "x",
        minimum: 0,
        maximum: 3,
      },
    ],
  };
  assert.equal(isRuntimePreferencesSnapshot(prefs), true);
  assert.equal(
    isRuntimePreferencesSnapshot({
      ...prefs,
      settings: { ...settings, budgets: { x: 4 } },
    }),
    false,
  );
  assert.equal(
    isRuntimePreferencesSnapshot({
      ...prefs,
      fields: [...prefs.fields, ...prefs.fields],
    }),
    false,
  );
});
test("protocol schemas are generated from the shared owner and source imports stay platform independent", () => {
  const schemas = v1JsonSchemas();
  for (const [name, schema] of Object.entries(schemas)) {
    assert.deepEqual(
      schema,
      JSON.parse(
        readFileSync(
          resolve(`packages/protocol/schemas/${name}.schema.json`),
          "utf8",
        ),
      ),
    );
  }
  for (const name of readdirSync(resolve("packages/protocol/src"))) {
    const source = readFileSync(resolve("packages/protocol/src", name), "utf8");
    const imports = [
      ...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu),
    ].map((match) => match[1]!);
    assert.ok(
      imports.every((value) => value.startsWith("./") || value === "zod"),
      `${name}: ${imports.join(", ")}`,
    );
    assert.doesNotMatch(
      source,
      /\b(?:process|window|localStorage|document)\./u,
    );
  }
});
test("v1 inventory names every literal HTTP dispatch route and every templated route has a host dispatcher", () => {
  const server = readFileSync(resolve("src/gui-host/server.ts"), "utf8");
  const literal = [
    ...server.matchAll(
      /method === "(GET|POST|DELETE)" && pathname === "([^"]+)"/gu,
    ),
  ]
    .map((m) => `${m[1]} ${m[2]}`)
    .sort();
  const listed = v1HttpRoutes
    .filter((route) => route[1] !== "/auth/login" && !route[1].includes("{"))
    .map((route) => `${route[0]} ${route[1]}`)
    .sort();
  assert.deepEqual(listed, literal);

  // Non-literal routes are dispatched through constants, regexes or helpers.
  assert.match(server, /GUI_PIN_LOGIN_PATH/u);
  assert.match(server, /handleBlobGet/u);
  assert.match(server, /const skillDelete = \/\^\\\/v1\\\/skills/u);
  assert.match(server, /const workspaceRoute = \/\^\\\/v1\\\/projects/u);
  assert.match(server, /tryServeStatic/u);
});

test("v1 prompt accepts one additive image locator while legacy prompt shape stays valid", () => {
  const legacy = {
    type: "prompt",
    requestId: "r1",
    sessionId: "s1",
    text: "hello",
  };
  assert.equal(clientMessageSchema.safeParse(legacy).success, true);
  const withImage = {
    ...legacy,
    attachment: {
      type: "image",
      locator: `source:${"a".repeat(64)}/photo.png`,
      mediaType: "image/png",
    },
  };
  assert.equal(clientMessageSchema.safeParse(withImage).success, true);
  assert.equal(
    clientMessageSchema.safeParse({
      ...legacy,
      attachment: { type: "image", locator: "", mediaType: "image/png" },
    }).success,
    false,
  );
});

test("platform V3 exports strict bounded durable resource contracts", () => {
  const conversation = {
    id: "conversation_1",
    tenantId: "tenant_1",
    projectId: "project_1",
    title: "Platform work",
    createdAt: 1,
    updatedAt: 1,
    revision: 0,
    messages: [],
  };
  assert.equal(
    platformV3ConversationSchema.safeParse(conversation).success,
    true,
  );
  assert.equal(
    platformV3ConversationSchema.safeParse({
      ...conversation,
      authority: "client",
    }).success,
    false,
  );
  assert.equal(
    platformV3RunCreateRequestSchema.safeParse({
      commandId: "command_1",
      expectedRevision: Number.MAX_SAFE_INTEGER + 1,
      model: "model",
      text: "hello",
    }).success,
    false,
  );
  assert.equal(
    platformV3RunCreateRequestSchema.safeParse({
      commandId: "command_1",
      expectedRevision: 0,
      model: "model",
      text: "hello",
      tenantId: "client-selected-authority",
    }).success,
    false,
  );
  assert.equal(
    platformV3RunCreateRequestSchema.safeParse({
      commandId: "",
      expectedRevision: 0,
      model: "model",
      text: "hello",
    }).success,
    false,
  );
  assert.equal(
    platformV3RunCreateRequestSchema.safeParse({
      commandId: "command_1",
      expectedRevision: 0,
      model: "model",
      text: "x".repeat(65_537),
    }).success,
    false,
  );
  assert.equal(
    platformV3EventsQuerySchema.safeParse({ projectId: "project_1" }).data
      ?.limit,
    100,
  );
});

test("platform V3 reuses established chat content while retaining strict V3 envelopes", () => {
  const establishedContent = [{ type: "text", text: "hello", extension: true }];
  assert.equal(chatContentSchema.safeParse(establishedContent).success, true);
  assert.equal(
    platformV3ConversationMessageSchema.safeParse({
      id: "message_1",
      role: "user",
      content: establishedContent,
      createdAt: 1,
    }).success,
    true,
  );
  assert.equal(
    platformV3ConversationMessageSchema.safeParse({
      id: "message_1",
      role: "user",
      content: "hello",
      createdAt: 1,
      extension: true,
    }).success,
    false,
  );
});

test("platform V3 generated artifacts match the shared protocol owner", () => {
  for (const [name, schema] of Object.entries(platformV3JsonSchemas())) {
    assert.deepEqual(
      schema,
      JSON.parse(
        readFileSync(
          resolve(`packages/protocol/schemas/${name}.schema.json`),
          "utf8",
        ),
      ),
    );
  }
  const openApi = platformV3OpenApiDocument();
  assert.deepEqual(
    openApi,
    JSON.parse(
      readFileSync(
        resolve("packages/protocol/schemas/platform-v3.openapi.json"),
        "utf8",
      ),
    ),
  );
  assert.ok(openApi.paths["/v3/events"]?.get);
});
