import assert from "node:assert/strict";
import test from "node:test";
import { ChatSession } from "../src/core/chat-session.js";
import { ChatError } from "../src/core/errors.js";
import type {
  ChatCallbacks,
  ChatRequest,
  ChatTransport,
} from "../src/core/types.js";

test("session commits user and assistant messages after success", async () => {
  const requests: ChatRequest[] = [];
  const transport: ChatTransport = {
    async complete(request, callbacks?: ChatCallbacks) {
      requests.push(request);
      callbacks?.onDelta?.({ type: "content", text: "hello" });
      return {
        message: { role: "assistant", content: "hello" },
      };
    },
  };
  const deltas: string[] = [];
  const session = new ChatSession({
    model: "provider/model",
    transport,
    systemMessage: "system",
    generation: { temperature: 0.5 },
  });

  await session.send("  hi  ", {
    onDelta: (delta) => deltas.push(delta.text),
  });

  assert.deepEqual(deltas, ["hello"]);
  assert.deepEqual(session.messages, [
    { role: "system", content: "system" },
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
  ]);
  assert.equal(requests[0]?.options?.temperature, 0.5);
});

test("session returns and streams reasoning without committing or replaying it", async () => {
  const reasoning = "private reasoning transcript";
  const requests: ChatRequest[] = [];
  const transport: ChatTransport = {
    async complete(request, callbacks) {
      requests.push(request);
      callbacks?.onDelta?.({ type: "reasoning", text: reasoning });
      return {
        message: { role: "assistant", content: `answer ${requests.length}` },
        reasoning,
      };
    },
  };
  const session = new ChatSession({ model: "provider/model", transport });
  const first = await session.send("first");
  await session.send("second");

  assert.equal(first.reasoning, reasoning);
  assert.deepEqual(session.messages, [
    { role: "user", content: "first" },
    { role: "assistant", content: "answer 1" },
    { role: "user", content: "second" },
    { role: "assistant", content: "answer 2" },
  ]);
  assert.equal(JSON.stringify(requests[1]?.messages).includes(reasoning), false);
});

test("session rolls back the user turn when the transport fails", async () => {
  const transport: ChatTransport = {
    async complete() {
      throw new ChatError("network", "failed");
    },
  };
  const session = new ChatSession({
    model: "provider/model",
    transport,
    systemMessage: "system",
  });

  await assert.rejects(() => session.send("not committed"));
  assert.deepEqual(session.messages, [{ role: "system", content: "system" }]);
});

test("session rejects empty messages before calling the transport", async () => {
  let calls = 0;
  const transport: ChatTransport = {
    async complete() {
      calls += 1;
      return { message: { role: "assistant", content: "unused" } };
    },
  };
  const session = new ChatSession({ model: "provider/model", transport });

  await assert.rejects(
    () => session.send("   "),
    (error: unknown) =>
      error instanceof ChatError && error.code === "configuration",
  );
  assert.equal(calls, 0);
});

test("reset preserves only the system message", async () => {
  const transport: ChatTransport = {
    async complete() {
      return { message: { role: "assistant", content: "answer" } };
    },
  };
  const session = new ChatSession({
    model: "provider/model",
    transport,
    systemMessage: "system",
  });
  await session.send("question");

  session.reset();
  assert.deepEqual(session.messages, [{ role: "system", content: "system" }]);
});
