import assert from "node:assert/strict";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import {
  RUN_CONTINUATION_STATE_VERSION,
  validateRunContinuationState,
} from "../src/core/chat-continuation.js";
import type { ChatRequest, ChatTools } from "../src/core/types.js";
import { ChatSession } from "../src/core/chat-session.js";

function state(
  runId: string,
  sourceRefs: readonly string[],
  statement = "verified",
) {
  return {
    version: RUN_CONTINUATION_STATE_VERSION,
    runId,
    verifiedFacts: [{ id: "fact-1", statement, sourceRefs }],
    hypotheses: [],
    completedActions: [],
  };
}

test("continuation state validates version, run, provenance and byte limit", () => {
  const runId = "run-a";
  const source = new Set(["run-a:1"]);
  const valid = validateRunContinuationState(state(runId, ["run-a:1"]), {
    runId,
    validSourceRefs: source,
    maximumBytes: 4096,
  });
  assert.equal(valid.verifiedFacts[0]?.sourceRefs[0], "run-a:1");
  assert.throws(
    () =>
      validateRunContinuationState(state(runId, ["missing"]), {
        runId,
        validSourceRefs: source,
        maximumBytes: 4096,
      }),
    ChatError,
  );
  assert.throws(
    () =>
      validateRunContinuationState(state("other", ["run-a:1"]), {
        runId,
        validSourceRefs: source,
        maximumBytes: 4096,
      }),
    ChatError,
  );
  assert.throws(
    () =>
      validateRunContinuationState(
        state(runId, ["run-a:1"], "🦊".repeat(200)),
        {
          runId,
          validSourceRefs: source,
          maximumBytes: 128,
        },
      ),
    ChatError,
  );
});

test("100 completed tool interactions compact to a bounded state plus the raw tail", async () => {
  const requests: ChatRequest[] = [];
  let response = 0;
  const tools: ChatTools = {
    definitions: [{ name: "inspect", description: "Inspect", parameters: {} }],
    maximumCalls: 110,
    continuation: {
      recentRawInteractions: 3,
      maximumStateBytes: 16_384,
      async compact(input) {
        const oldRefs = input.previous?.verifiedFacts[0]?.sourceRefs ?? [];
        return state(
          input.runId,
          [
            ...oldRefs,
            ...input.interactions.map((interaction) => interaction.id),
          ],
          `Completed ${oldRefs.length + input.interactions.length} interactions`,
        );
      },
    },
    async execute() {
      return `result-${response++}`;
    },
  };
  const session = new ChatSession({
    model: "fixture/model",
    transport: {
      async complete(request) {
        requests.push(request);
        if (response < 100) {
          return {
            message: { role: "assistant", content: "" },
            toolCalls: [
              { id: `call-${response}`, name: "inspect", arguments: "{}" },
            ],
          };
        }
        return { message: { role: "assistant", content: "done" } };
      },
    },
  });
  await session.send("run many bounded tool actions", { tools });

  const last = requests.at(-1)!;
  const toolMessages = last.messages.filter(
    (message) => message.role === "tool",
  );
  assert.equal(toolMessages.length, 3);
  const serialized = JSON.stringify(last.messages);
  assert.match(serialized, /a008_run_continuation_state_v1/);
  assert.match(serialized, /Completed 97 interactions/i);
  assert.equal(session.messages.length, 2);
  assert.equal(requests.length, 101);
});

test("invalid later compaction leaves the previous valid projection and raw history intact", async () => {
  const requests: ChatRequest[] = [];
  let completed = 0;
  let compactCalls = 0;
  const tools: ChatTools = {
    definitions: [{ name: "inspect", description: "Inspect", parameters: {} }],
    maximumCalls: 8,
    continuation: {
      recentRawInteractions: 1,
      maximumStateBytes: 4096,
      async compact(input) {
        compactCalls += 1;
        if (compactCalls === 2) return { invalid: true };
        return state(input.runId, [
          ...(input.previous?.verifiedFacts[0]?.sourceRefs ?? []),
          ...input.interactions.map((item) => item.id),
        ]);
      },
    },
    async execute() {
      completed += 1;
      return `result-${completed}`;
    },
  };
  const session = new ChatSession({
    model: "fixture/model",
    transport: {
      async complete(request) {
        requests.push(request);
        return {
          message: { role: "assistant", content: "" },
          toolCalls: [
            { id: `call-${requests.length}`, name: "inspect", arguments: "{}" },
          ],
        };
      },
    },
  });
  await assert.rejects(
    () => session.send("exercise compaction failure", { tools }),
    ChatError,
  );
  assert.equal(requests.length, 3);
  assert.equal(completed, 3);
  assert.equal(compactCalls, 2);
  const priorProjection = JSON.stringify(requests[2]?.messages);
  assert.match(priorProjection, /a008_run_continuation_state_v1/);
  assert.match(priorProjection, /result-2/);
  assert.match(priorProjection, /result-3/);
  assert.deepEqual(session.messages, []);
});

test("a tool batch that fails before completion is never offered to the compactor", async () => {
  let compactions = 0;
  let calls = 0;
  const tools: ChatTools = {
    definitions: [{ name: "mutate", description: "Mutate", parameters: {} }],
    maximumCalls: 4,
    continuation: {
      recentRawInteractions: 0,
      maximumStateBytes: 2048,
      async compact(input) {
        compactions += 1;
        return state(
          input.runId,
          input.interactions.map((item) => item.id),
        );
      },
    },
    async execute() {
      calls += 1;
      if (calls === 2) throw new Error("second operation failed");
      return "first operation completed";
    },
  };
  const session = new ChatSession({
    model: "fixture/model",
    transport: {
      async complete() {
        return {
          message: { role: "assistant", content: "" },
          toolCalls: [
            { id: "call-a", name: "mutate", arguments: "{}" },
            { id: "call-b", name: "mutate", arguments: "{}" },
          ],
        };
      },
    },
  });
  await assert.rejects(() => session.send("do the atomic batch", { tools }));
  assert.equal(calls, 2);
  assert.equal(compactions, 0);
});

test("tools without continuation retain the complete existing wire history", async () => {
  const requests: ChatRequest[] = [];
  let round = 0;
  const session = new ChatSession({
    model: "fixture/model",
    transport: {
      async complete(request) {
        requests.push(request);
        round += 1;
        return round < 4
          ? {
              message: { role: "assistant", content: "" },
              toolCalls: [
                { id: `call-${round}`, name: "inspect", arguments: "{}" },
              ],
            }
          : { message: { role: "assistant", content: "done" } };
      },
    },
  });
  await session.send("unchanged", {
    tools: {
      definitions: [
        { name: "inspect", description: "Inspect", parameters: {} },
      ],
      maximumCalls: 4,
      async execute() {
        return "raw-result";
      },
    },
  });
  assert.equal(
    requests.at(-1)?.messages.filter((message) => message.role === "tool")
      .length,
    3,
  );
  assert.equal(
    JSON.stringify(requests.at(-1)?.messages).includes(
      "a008_run_continuation_state_v1",
    ),
    false,
  );
});

test("continuation projection preserves current-user then continuation then raw-tail ordering", async () => {
  const requests: ChatRequest[] = [];
  let toolResult = 0;
  const session = new ChatSession({
    model: "fixture/model",
    transport: {
      async complete(request) {
        requests.push(request);
        if (requests.length < 3) {
          return {
            message: { role: "assistant", content: "" },
            toolCalls: [
              {
                id: `call-${requests.length}`,
                name: "inspect",
                arguments: "{}",
              },
            ],
          };
        }
        return { message: { role: "assistant", content: "done" } };
      },
    },
  });

  await session.send("preserve ordering", {
    tools: {
      definitions: [
        { name: "inspect", description: "Inspect", parameters: {} },
      ],
      maximumCalls: 4,
      continuation: {
        recentRawInteractions: 1,
        maximumStateBytes: 4096,
        async compact(input) {
          return state(
            input.runId,
            [
              ...(input.previous?.verifiedFacts[0]?.sourceRefs ?? []),
              ...input.interactions.map((item) => item.id),
            ],
            "earlier completed work",
          );
        },
      },
      async execute() {
        toolResult += 1;
        return `result-${toolResult}`;
      },
    },
  });

  const projected = requests[2]!.messages;
  assert.deepEqual(
    projected.map((message) => message.role),
    ["system", "user", "user", "assistant", "tool"],
  );
  assert.equal(projected[1]?.content, "preserve ordering");
  assert.match(String(projected[2]?.content), /a008_run_continuation_state_v1/);
  assert.equal(projected[3]?.role, "assistant");
  assert.equal(projected[4]?.role, "tool");
  assert.equal(projected[4]?.content, "result-2");
});

test("later compaction receives the full prior state and cannot drop its source coverage", async () => {
  const requests: ChatRequest[] = [];
  let compactCalls = 0;
  let firstRunId: string | undefined;
  let previousRunId: string | undefined;
  let result = 0;

  const session = new ChatSession({
    model: "fixture/model",
    transport: {
      async complete(request) {
        requests.push(request);
        return {
          message: { role: "assistant", content: "" },
          toolCalls: [
            {
              id: `call-${requests.length}`,
              name: "inspect",
              arguments: "{}",
            },
          ],
        };
      },
    },
  });

  await assert.rejects(
    () =>
      session.send("preserve cumulative continuation evidence", {
        tools: {
          definitions: [
            { name: "inspect", description: "Inspect", parameters: {} },
          ],
          maximumCalls: 8,
          continuation: {
            recentRawInteractions: 1,
            maximumStateBytes: 4096,
            async compact(input) {
              compactCalls += 1;
              if (compactCalls === 1) {
                firstRunId = input.runId;
                return state(
                  input.runId,
                  input.interactions.map((item) => item.id),
                );
              }
              previousRunId = input.previous?.runId;
              return state(
                input.runId,
                input.interactions.map((item) => item.id),
              );
            },
          },
          async execute() {
            result += 1;
            return `result-${result}`;
          },
        },
      }),
    (error: unknown) =>
      error instanceof ChatError &&
      /dropped required source/.test(error.message),
  );

  assert.equal(compactCalls, 2);
  assert.equal(previousRunId, firstRunId);
  assert.equal(requests.length, 3);
  assert.equal(result, 3);
});
