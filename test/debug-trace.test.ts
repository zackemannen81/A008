import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createDebugTracer,
  redactHeaders,
  redactSecrets,
  tracedFetch,
} from "../src/runtime/debug-trace.js";
import { isolatedMemoryEnv, uniqueTraceFile } from "./helpers.js";

test("redaction removes secrets from headers and payloads", () => {
  const headers = redactHeaders({
    authorization: "Bearer super-secret-key",
    "content-type": "application/json",
    "x-api-key": "another-secret",
  });
  assert.equal(headers.authorization, "[redacted]");
  assert.equal(headers["x-api-key"], "[redacted]");
  assert.equal(headers["content-type"], "application/json");
  assert.equal(
    redactSecrets("token super-secret-key used", ["super-secret-key"]),
    "token [redacted] used",
  );
});

test("off mode emits nothing and raw mode truncates oversized payloads", async () => {
  const isolated = isolatedMemoryEnv();
  const off = createDebugTracer({ mode: "off", surface: "test" });
  off.emit({
    traceId: "t",
    surface: "test",
    phase: "turn_start",
    payload: { secret: "NVIDIA_API_KEY=should-not-matter" },
  });
  await off.flush();

  const file = uniqueTraceFile(isolated.directory);
  const tracer = createDebugTracer({
    mode: "raw",
    surface: "test",
    filePath: file,
    secrets: ["super-secret-key"],
    maxEventChars: 400,
    maxFileBytes: 2_048,
  });
  tracer.emit({
    traceId: "trace-1",
    surface: "test",
    phase: "chat_request",
    payload: `super-secret-key ${"x".repeat(2_000)}`,
  });
  await tracer.flush();
  const text = readFileSync(file, "utf8");
  assert.equal(text.includes("super-secret-key"), false);
  assert.match(text, /truncated/u);
  assert.equal(text.includes("process.env"), false);
  assert.equal(text.includes("NVIDIA_API_KEY"), false);
});

test("traced fetch clones the body and never logs authorization", async () => {
  const isolated = isolatedMemoryEnv();
  const file = uniqueTraceFile(isolated.directory);
  const tracer = createDebugTracer({
    mode: "raw",
    surface: "test",
    filePath: file,
    secrets: ["local-test-key"],
  });
  const fetch = tracedFetch(
    async () =>
      new Response('data: {"choices":[]}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    tracer,
    "test",
  );
  const response = await fetch("http://127.0.0.1/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: "Bearer local-test-key",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: "x", messages: [] }),
  });
  const transportBody = await response.text();
  await tracer.flush();
  const recorded = readFileSync(file, "utf8");
  assert.match(transportBody, /data: /u);
  assert.equal(recorded.includes("local-test-key"), false);
  assert.equal(recorded.includes("Bearer "), false);
  assert.match(recorded, /provider_http_request/u);
  assert.match(recorded, /provider_http_response/u);
  assert.match(recorded, /"operation":"chat"/u);
  assert.match(recorded, /httpCallId/u);
  assert.match(recorded, /data: \{\\"choices\\":\[\]\}/u);
});

test("traced fetch labels semantic HTTP calls by operation", async () => {
  const isolated = isolatedMemoryEnv();
  const file = uniqueTraceFile(isolated.directory);
  const tracer = createDebugTracer({
    mode: "safe",
    surface: "test",
    filePath: file,
  });
  const fetch = tracedFetch(
    async () => new Response("{}", { status: 200 }),
    tracer,
    "test",
  );
  await fetch("http://127.0.0.1/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      stream: false,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            operation: "knowledge_analysis",
            input: { message: "m", answer: "a" },
          }),
        },
      ],
    }),
  });
  await tracer.flush();
  const recorded = readFileSync(file, "utf8");
  assert.match(recorded, /"operation":"knowledge_analysis"/u);
});
