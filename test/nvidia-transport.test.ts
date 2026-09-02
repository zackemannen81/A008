import assert from "node:assert/strict";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import type { ChatRequest } from "../src/core/types.js";
import {
  NVIDIA_CHAT_COMPLETIONS_URL,
  NvidiaChatTransport,
  type FetchLike,
} from "../src/providers/nvidia/nvidia-chat-transport.js";
import { byteStream, splitBytes } from "./helpers.js";

const request: ChatRequest = {
  model: "nvidia/nemotron-3.5-lightning-30b-a3b",
  messages: [{ role: "user", content: "hello" }],
  options: {
    temperature: 1,
    topP: 0.95,
    maxTokens: 128,
    reasoningBudget: 64,
    enableThinking: true,
    stream: true,
  },
};

test("streaming transport sends the expected payload and assembles deltas", async () => {
  const sse = [
    'data: {"choices":[{"delta":{"reasoning_content":"think "}}]}\r\n\r\n',
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n',
    "data: [DONE]\n\n",
  ].join("");
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetch: FetchLike = async (input, init) => {
    capturedUrl = input.toString();
    capturedInit = init;
    return new Response(byteStream(splitBytes(sse, [3, 1, 11, 2])), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  };
  const transport = new NvidiaChatTransport({
    apiKey: "test-token",
    fetch,
  });
  const deltas: string[] = [];

  const result = await transport.complete(request, {
    onDelta: (delta) => deltas.push(`${delta.type}:${delta.text}`),
  });

  assert.equal(capturedUrl, NVIDIA_CHAT_COMPLETIONS_URL);
  assert.equal(
    new Headers(capturedInit?.headers).get("authorization"),
    "Bearer test-token",
  );
  const payload = JSON.parse(String(capturedInit?.body)) as Record<string, unknown>;
  assert.equal(payload.model, request.model);
  assert.equal(payload.top_p, 0.95);
  assert.equal(payload.reasoning_budget, 64);
  assert.deepEqual(payload.chat_template_kwargs, { enable_thinking: true });
  assert.deepEqual(deltas, [
    "reasoning:think ",
    "content:Hello",
    "content: world",
  ]);
  assert.equal(result.reasoning, "think ");
  assert.equal(result.message.content, "Hello world");
  assert.equal(result.finishReason, "stop");
});

test("non-streaming transport reads content, reasoning, finish reason, and usage", async () => {
  const fetch: FetchLike = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: { content: "answer", reasoning_content: "reason" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  const transport = new NvidiaChatTransport({ apiKey: "test-token", fetch });

  const result = await transport.complete({
    ...request,
    options: { ...request.options, stream: false },
  });

  assert.equal(result.message.content, "answer");
  assert.equal(result.reasoning, "reason");
  assert.deepEqual(result.usage, {
    promptTokens: 2,
    completionTokens: 3,
    totalTokens: 5,
  });
});

for (const [status, code, retryable] of [
  [401, "authentication", false],
  [403, "authentication", false],
  [429, "rate_limit", true],
  [422, "provider", false],
  [503, "server", true],
] as const) {
  test(`HTTP ${status} becomes ${code}`, async () => {
    const fetch: FetchLike = async () => new Response("ignored", { status });
    const transport = new NvidiaChatTransport({ apiKey: "test-token", fetch });

    await assert.rejects(
      () => transport.complete(request),
      (error: unknown) =>
        error instanceof ChatError &&
        error.code === code &&
        error.status === status &&
        error.retryable === retryable &&
        !error.message.includes("test-token"),
    );
  });
}

test("network failures become retryable network errors", async () => {
  const fetch: FetchLike = async () => {
    throw new Error("socket failed");
  };
  const transport = new NvidiaChatTransport({ apiKey: "test-token", fetch });

  await assert.rejects(
    () => transport.complete(request),
    (error: unknown) =>
      error instanceof ChatError &&
      error.code === "network" &&
      error.retryable,
  );
});

test("timeout aborts the fake request and becomes a timeout error", async () => {
  const fetch: FetchLike = async (_input, init) =>
    await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("aborted", "AbortError")),
        { once: true },
      );
    });
  const transport = new NvidiaChatTransport({
    apiKey: "test-token",
    fetch,
    timeoutMs: 5,
  });

  await assert.rejects(
    () => transport.complete(request),
    (error: unknown) =>
      error instanceof ChatError && error.code === "timeout",
  );
});

test("invalid streaming JSON becomes an invalid-response error", async () => {
  const fetch: FetchLike = async () =>
    new Response(byteStream(["data: not-json\n\n"]), { status: 200 });
  const transport = new NvidiaChatTransport({ apiKey: "test-token", fetch });

  await assert.rejects(
    () => transport.complete(request),
    (error: unknown) =>
      error instanceof ChatError && error.code === "invalid_response",
  );
});

test("a stream without a chat choice is invalid", async () => {
  const fetch: FetchLike = async () =>
    new Response(byteStream(["data: [DONE]\n\n"]), { status: 200 });
  const transport = new NvidiaChatTransport({ apiKey: "test-token", fetch });

  await assert.rejects(
    () => transport.complete(request),
    (error: unknown) =>
      error instanceof ChatError && error.code === "invalid_response",
  );
});

test("an already-aborted request is cancelled", async () => {
  let calls = 0;
  const fetch: FetchLike = async (_input, init) => {
    calls += 1;
    assert.equal(init?.signal?.aborted, true);
    throw new DOMException("aborted", "AbortError");
  };
  const transport = new NvidiaChatTransport({ apiKey: "test-token", fetch });
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => transport.complete({ ...request, signal: controller.signal }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "cancelled",
  );
  assert.equal(calls, 1);
});

test("missing API key fails before fetch can be used", () => {
  let calls = 0;
  const fetch: FetchLike = async () => {
    calls += 1;
    return new Response();
  };

  assert.throws(
    () => new NvidiaChatTransport({ apiKey: " ", fetch }),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  assert.equal(calls, 0);
});
