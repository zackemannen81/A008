import assert from "node:assert/strict";
import test from "node:test";
import { KieChatTransport } from "../src/providers/kie/kie-chat-transport.js";

test("empty kie chat key fails before fetch", () => {
  assert.throws(
    () => new KieChatTransport({ apiKey: "  " }),
    /KIE_API_KEY is required/u,
  );
});

test("kie chat posts OpenAI-compatible JSON to the model URL", async () => {
  let url = "";
  let body = "";
  const transport = new KieChatTransport({
    apiKey: "kie-secret",
    fetch: async (input, init) => {
      url = String(input);
      body = String(init?.body ?? "");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: { role: "assistant", content: "hello from kie" },
              finish_reason: "stop",
            },
          ],
        }),
      );
    },
  });
  const result = await transport.complete({
    model: "gemini-3-flash",
    messages: [{ role: "user", content: "hi" }],
    options: { stream: false },
  });
  assert.match(url, /\/gemini-3-flash\/v1\/chat\/completions$/u);
  assert.match(body, /"content":"hi"/u);
  assert.equal(body.includes("reasoning_budget"), false);
  assert.equal(result.message.content, "hello from kie");
  assert.equal(JSON.stringify(result).includes("kie-secret"), false);
});

test("kie chat reads SSE content deltas", async () => {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          'data: {"choices":[{"delta":{"content":"He"}}]}\n\n',
        ),
      );
      controller.enqueue(
        new TextEncoder().encode(
          'data: {"choices":[{"delta":{"content":"j"}}]}\n\n',
        ),
      );
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  const transport = new KieChatTransport({
    apiKey: "kie-secret",
    fetch: async () =>
      new Response(stream, {
        headers: { "content-type": "text/event-stream" },
      }),
  });
  const result = await transport.complete({
    model: "gemini-3-flash",
    messages: [{ role: "user", content: "hi" }],
    options: { stream: true },
  });
  assert.equal(result.message.content, "Hej");
});
