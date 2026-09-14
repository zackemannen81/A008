import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { clientMessageSchema, hostServerMessageSchema, serverMessageSchema, parseServerMessage,
  isRuntimePreferencesSnapshot, v1JsonSchemas, v1HttpRoutes } from "../packages/protocol/src/index.js";
import { parseClientMessage } from "../src/gui-host/protocol.js";

const fixtures = JSON.parse(readFileSync(resolve("packages/protocol/fixtures/v1-compatibility.json"), "utf8")) as {
  client: { raw: string; value?: unknown; error?: string; name?: string }[];
  server: { raw: unknown; value?: unknown; error?: string; name?: string }[];
};
function capture(operation: () => unknown) {
  try { return { value: operation() ?? null }; }
  catch (error) { return { error: (error as Error).message, name: (error as Error).name }; }
}
test("shared v1 parsers preserve all frozen legacy acceptance and error cases", () => {
  for (const { raw, ...expected } of fixtures.client) {
    assert.deepEqual(capture(() => parseClientMessage(raw)), expected, raw);
    const parsed = parseClientMessage(raw);
    if (!("error" in parsed)) assert.equal(clientMessageSchema.safeParse(parsed).success, true, raw);
  }
  for (const { raw, ...expected } of fixtures.server) {
    assert.deepEqual(capture(() => parseServerMessage(raw)), expected, JSON.stringify(raw));
    if (expected.value) assert.equal(serverMessageSchema.safeParse(expected.value).success, true, JSON.stringify(raw));
  }
});
test("v1 distinguishes current host output from accepted older replies and preserves additive snapshots", () => {
  const old = { type: "session/new/ok", requestId: "r", sessionId: "s" };
  assert.equal(serverMessageSchema.safeParse(old).success, true);
  assert.equal(hostServerMessageSchema.safeParse(old).success, false);
  assert.equal(hostServerMessageSchema.safeParse({ ...old, resumeToken: "a".repeat(64) }).success, true);
  assert.equal(parseServerMessage({ type: "future/addition", field: "value" }), undefined);
  const settings = { instructions: "", budgets: { x: 2 }, memoryLifecycle: { future: true } };
  const prefs = { revision: "r", settings, defaults: settings, storagePath: null,
    fields: [{ key: "x", label: "x", unit: "n", description: "x", minimum: 0, maximum: 3 }] };
  assert.equal(isRuntimePreferencesSnapshot(prefs), true);
  assert.equal(isRuntimePreferencesSnapshot({ ...prefs, settings: { ...settings, budgets: { x: 4 } } }), false);
  assert.equal(isRuntimePreferencesSnapshot({ ...prefs, fields: [...prefs.fields, ...prefs.fields] }), false);
});
test("protocol schemas are generated from the shared owner and source imports stay platform independent", () => {
  const schemas = v1JsonSchemas();
  for (const [name, schema] of Object.entries(schemas)) {
    assert.deepEqual(schema, JSON.parse(readFileSync(resolve(`packages/protocol/schemas/${name}.schema.json`), "utf8")));
  }
  for (const name of readdirSync(resolve("packages/protocol/src"))) {
    const source = readFileSync(resolve("packages/protocol/src", name), "utf8");
    const imports = [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/gu)].map(match => match[1]!);
    assert.ok(imports.every(value => value.startsWith("./") || value === "zod"), `${name}: ${imports.join(", ")}`);
    assert.doesNotMatch(source, /\b(?:process|window|localStorage|document)\./u);
  }
});
test("v1 inventory names every literal HTTP dispatch route plus login, blobs and static assets", () => {
  const server = readFileSync(resolve("src/gui-host/server.ts"), "utf8");
  const literal = [...server.matchAll(/method === "(GET|POST|DELETE)" && pathname === "([^"]+)"/gu)].map(m => `${m[1]} ${m[2]}`).sort();
  const special = new Set(["/auth/login", "/v1/blobs/{sha256}/{name}", "/{asset}"]);
  const listed = v1HttpRoutes.filter(route => !special.has(route[1])).map(route => `${route[0]} ${route[1]}`).sort();
  assert.deepEqual(listed, literal);
  assert.match(server, /GUI_PIN_LOGIN_PATH/u);
  assert.match(server, /handleBlobGet/u);
  assert.match(server, /tryServeStatic/u);
});
