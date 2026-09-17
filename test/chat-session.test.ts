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

test("undoLastTurn drops the last user and assistant pair", async () => {
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
  await session.send("hi");
  assert.equal(session.undoLastTurn(), true);
  assert.deepEqual(session.messages, [{ role: "system", content: "system" }]);
  assert.equal(session.undoLastTurn(), false);
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

test("unavailable and duplicate tool calls name the offending call", async () => {
  const offered = {
    definitions: [{ name: "read_file", description: "Read", parameters: { type: "object", properties: {} } }],
    maximumCalls: 4,
    async execute() { return "ok"; },
  };
  const session = new ChatSession({
    model: "provider/model",
    transport: {
      async complete() {
        return {
          message: { role: "assistant", content: "" },
          toolCalls: [{ id: "call-1", name: "memory", arguments: "{}" }],
        };
      },
    },
  });
  await assert.rejects(
    () => session.send("use memory", { tools: offered }),
    (error: unknown) =>
      error instanceof ChatError &&
      error.message.includes('unavailable tool "memory"'),
  );

  let round = 0;
  const looping = new ChatSession({
    model: "provider/model",
    transport: {
      async complete() {
        round += 1;
        if (round === 1) {
          return {
            message: { role: "assistant", content: "" },
            toolCalls: [{ id: "call-1", name: "read_file", arguments: "{}" }],
          };
        }
        return {
          message: { role: "assistant", content: "" },
          toolCalls: [{ id: "call-1", name: "read_file", arguments: "{}" }],
        };
      },
    },
  });
  await assert.rejects(
    () => looping.send("read twice", { tools: offered }),
    (error: unknown) =>
      error instanceof ChatError &&
      error.message.includes("duplicate tool call id (call-1)"),
  );
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

test("native image input survives same-turn tool continuation but never enters committed history", async () => {
  const seen: ChatRequest[] = [];
  let round = 0;
  const session = new ChatSession({
    model: "provider/vision",
    transport: {
      async complete(request) {
        seen.push(request);
        round += 1;
        if (round === 1) {
          return {
            message: { role: "assistant", content: "" },
            toolCalls: [{ id: "call-vision", name: "inspect", arguments: "{}" }],
          };
        }
        return { message: { role: "assistant", content: "final answer" } };
      },
    },
  });
  await session.send("what is in this image?", {
    imageAttachments: [{ mediaType: "image/png", dataRef: "data:image/png;base64,AAAA" }],
    tools: {
      definitions: [{ name: "inspect", description: "Inspect", parameters: { type: "object", properties: {} } }],
      maximumCalls: 2,
      async execute() { return "tool result"; },
    },
  });
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[0]?.imageAttachments, [{ mediaType: "image/png", dataRef: "data:image/png;base64,AAAA" }]);
  assert.deepEqual(seen[1]?.imageAttachments, seen[0]?.imageAttachments);
  assert.deepEqual(session.messages, [
    { role: "user", content: "what is in this image?" },
    { role: "assistant", content: "final answer" },
  ]);
  assert.equal(JSON.stringify(session.messages).includes("base64"), false);
});
