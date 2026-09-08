import assert from "node:assert/strict";
import test from "node:test";
import {
  OPENAI_CHAT_COMPLETIONS_URL,
  OpenAiChatTransport,
} from "../src/providers/openai/openai-chat-transport.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sseResponse(events: readonly string[]): Response {
  return new Response(
    events.map((event) => `data: ${event}\n\n`).join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
}

test("OpenAI Luna maps A008 chat controls and tools to Chat Completions", async () => {
  let url = "";
  let auth = "";
  let body = "";
  const transport = new OpenAiChatTransport({
    apiKey: "sk-test-secret",
    fetch: async (input, init) => {
      url = String(input);
      auth = String((init?.headers as Record<string, string>)?.authorization ?? "");
      body = String(init?.body ?? "");
      return jsonResponse({
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      });
    },
  });
  const completion = await transport.complete({
    model: "gpt-5.6-luna",
    messages: [{ role: "user", content: "hi" }],
    tools: [{ name: "read_file", description: "Read", parameters: { type: "object" } }],
    options: { stream: false, maxTokens: 1234, reasoningEffort: "medium", temperature: 0.7 },
  });
  assert.equal(url, OPENAI_CHAT_COMPLETIONS_URL);
  assert.equal(auth, "Bearer sk-test-secret");
  assert.equal(body.includes("sk-test-secret"), false);
  const payload = JSON.parse(body) as Record<string, unknown>;
  assert.equal(payload.model, "gpt-5.6-luna");
  assert.equal(payload.max_completion_tokens, 1234);
  assert.equal(payload.reasoning_effort, "none");
  assert.equal(Object.hasOwn(payload, "temperature"), false);
  assert.equal(Array.isArray(payload.tools), true);
  assert.equal(payload.tool_choice, "auto");
  assert.equal(completion.message.content, "ok");
  assert.deepEqual(completion.usage, { promptTokens: 4, completionTokens: 2, totalTokens: 6 });
});

test("OpenAI tool calls map back into A008 structured calls", async () => {
  const transport = new OpenAiChatTransport({
    apiKey: "sk-test",
    fetch: async () => jsonResponse({
      choices: [{
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "call_1",
            type: "function",
            function: { name: "git", arguments: "{\"args\":[\"status\"]}" },
          }],
        },
        finish_reason: "tool_calls",
      }],
    }),
  });
  const result = await transport.complete({
    model: "gpt-5.6-luna",
    messages: [{ role: "user", content: "status" }],
    options: { stream: false },
  });
  assert.equal(result.message.content, "");
  assert.deepEqual(result.toolCalls, [{
    id: "call_1",
    name: "git",
    arguments: "{\"args\":[\"status\"]}",
  }]);
});

test("OpenAI streaming preserves content and assembles fragmented tool calls", async () => {
  const deltas: string[] = [];
  const transport = new OpenAiChatTransport({
    apiKey: "sk-test",
    fetch: async () => sseResponse([
      JSON.stringify({ choices: [{ delta: { content: "Hi " }, finish_reason: null }] }),
      JSON.stringify({ choices: [{ delta: { content: "there" }, finish_reason: null }] }),
      JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_", type: "function", function: { name: "read_", arguments: "{\"path\":\"" } }] }, finish_reason: null }] }),
      JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: "1", function: { name: "file", arguments: "a.txt\"}" } }] }, finish_reason: "tool_calls" }] }),
      JSON.stringify({ choices: [], usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } }),
      "[DONE]",
    ]),
  });
  const result = await transport.complete({
    model: "gpt-5.6-luna",
    messages: [{ role: "user", content: "go" }],
    options: { stream: true },
  }, { onDelta: (delta) => deltas.push(delta.text) });
  assert.deepEqual(deltas, ["Hi ", "there"]);
  assert.equal(result.message.content, "Hi there");
  assert.deepEqual(result.toolCalls, [{
    id: "call_1",
    name: "read_file",
    arguments: "{\"path\":\"a.txt\"}",
  }]);
  assert.deepEqual(result.usage, { promptTokens: 3, completionTokens: 4, totalTokens: 7 });
});

test("OpenAI HTTP 429 is a typed retryable rate-limit error", async () => {
  const transport = new OpenAiChatTransport({
    apiKey: "sk-test",
    fetch: async () => jsonResponse({ error: { message: "slow down" } }, 429),
  });
  await assert.rejects(
    () => transport.complete({
      model: "gpt-5.6-luna",
      messages: [{ role: "user", content: "hi" }],
      options: { stream: false },
    }),
    (error: unknown) =>
      typeof error === "object" && error !== null &&
      "code" in error && error.code === "rate_limit" &&
      "retryable" in error && error.retryable === true,
  );
});

test("OpenAI provider errors preserve the bounded provider message", async () => {
  const transport = new OpenAiChatTransport({
    apiKey: "sk-test",
    fetch: async () => jsonResponse({ error: { message: "Unsupported parameter combination." } }, 400),
  });
  await assert.rejects(
    () => transport.complete({
      model: "gpt-5.6-luna",
      messages: [{ role: "user", content: "hi" }],
      options: { stream: false },
    }),
    (error: unknown) =>
      error instanceof Error &&
      /HTTP 400: Unsupported parameter combination\./u.test(error.message),
  );
});
