import assert from "node:assert/strict";
import test from "node:test";
import { ChatError } from "../src/core/errors.js";
import {
  RUN_CONTINUATION_STATE_VERSION,
  type RunContinuationState,
} from "../src/core/chat-continuation.js";
import type {
  ChatCompletion,
  ChatRequest,
  ChatTools,
  ChatTransport,
  SerializedChatRequestMeasurement,
} from "../src/core/types.js";
import { ChatSession } from "../src/core/chat-session.js";

function measure(request: ChatRequest): SerializedChatRequestMeasurement {
  return {
    routeId: "fixture-route",
    serializedBytes: Buffer.byteLength(
      JSON.stringify({
        model: request.model,
        messages: request.messages,
        tools: request.tools ?? [],
        options: request.options ?? {},
      }),
      "utf8",
    ),
  };
}

function reduceFromRequest(request: ChatRequest): RunContinuationState {
  const body = JSON.parse(String(request.messages[1]?.content)) as {
    runId: string;
    interactions: { id: string }[];
    previous: RunContinuationState | null;
  };
  const refs = [
    ...(body.previous?.verifiedFacts[0]?.sourceRefs ?? []),
    ...body.interactions.map((item) => item.id),
  ];
  return {
    version: RUN_CONTINUATION_STATE_VERSION,
    runId: body.runId,
    verifiedFacts: [
      { id: "fact", statement: "completed prior work", sourceRefs: refs },
    ],
    hypotheses: [],
    completedActions: [],
  };
}

function tools(input: {
  events: string[];
  pressureBytes: number;
  maximumBytes?: number;
  maximumCalls?: number;
  checkpointRunIds?: string[];
}): ChatTools {
  let completed = 0;
  return {
    definitions: [
      { name: "inspect", description: "Inspect", parameters: { type: "object" } },
    ],
    maximumCalls: input.maximumCalls ?? 10,
    continuation: {
      recentRawInteractions: 1,
      maximumStateBytes: 8192,
      pressure: {
        routeBudget: {
          pressureBytes: input.pressureBytes,
          maximumBytes: input.maximumBytes ?? 100_000,
          reducerInputBytes: 20_000,
          reducerOutputTokens: 512,
        },
        async persistCheckpoint({ runId, state, sourceInteractions }) {
          input.events.push("checkpoint");
          input.checkpointRunIds?.push(runId);
          assert.ok(state.verifiedFacts.length > 0);
          assert.ok(sourceInteractions.length > 0);
        },
      },
      async compact({ runId, previous, interactions }) {
        return {
          version: RUN_CONTINUATION_STATE_VERSION,
          runId,
          verifiedFacts: [
            {
              id: "legacy",
              statement: "legacy",
              sourceRefs: [
                ...(previous?.verifiedFacts[0]?.sourceRefs ?? []),
                ...interactions.map((item) => item.id),
              ],
            },
          ],
          hypotheses: [],
          completedActions: [],
        };
      },
    },
    async execute() {
      completed += 1;
      return `result-${completed}-${"x".repeat(120)}`;
    },
  };
}

function reducerCompletion(request: ChatRequest): ChatCompletion {
  return {
    message: {
      role: "assistant",
      content: JSON.stringify(reduceFromRequest(request)),
    },
  };
}

test("pressure reduces at completed-tool boundary, persists before adopting and preserves raw tail", async () => {
  const requests: ChatRequest[] = [];
  const events: string[] = [];
  let mainDispatches = 0;
  const transport: ChatTransport = {
    measureRequest: measure,
    async complete(request) {
      requests.push(structuredClone(request));
      if (request.options?.maxTokens === 512) return reducerCompletion(request);
      mainDispatches += 1;
      events.push(`dispatch-${mainDispatches}`);
      if (mainDispatches <= 3) {
        return {
          message: { role: "assistant", content: "" },
          toolCalls: [
            { id: `call-${mainDispatches}`, name: "inspect", arguments: "{}" },
          ],
        };
      }
      return { message: { role: "assistant", content: "done" } };
    },
  };
  const session = new ChatSession({ model: "fixture/model", transport });
  await session.send("continue safely", {
    tools: tools({ events, pressureBytes: 100 }),
  });

  assert.ok(events.includes("checkpoint"));
  assert.ok(
    events.indexOf("checkpoint") <
      events.findIndex((event) => event === "dispatch-3"),
  );
  assert.equal(mainDispatches, 4);
  const finalRequest = requests
    .filter((request) => request.options?.maxTokens !== 512)
    .at(-1)!;
  assert.ok(
    finalRequest.messages.some(
      (message) =>
        message.role === "user" &&
        String(message.content).includes(RUN_CONTINUATION_STATE_VERSION),
    ),
  );
  assert.equal(
    finalRequest.messages.filter((message) => message.role === "tool").length,
    1,
  );
  assert.deepEqual(
    session.messages.map((message) => message.role),
    ["user", "assistant"],
  );
});

test("route without exact measurement fails closed before provider dispatch", async () => {
  let dispatched = 0;
  const session = new ChatSession({
    model: "fixture/model",
    transport: {
      async complete() {
        dispatched += 1;
        return { message: { role: "assistant", content: "unused" } };
      },
    },
  });
  await assert.rejects(() =>
    session.send("question", {
      tools: tools({ events: [], pressureBytes: 1 }),
    }),
  );
  assert.equal(dispatched, 0);
});

test("selected route identity cannot change after its pressure budget is bound", async () => {
  let measurements = 0;
  let dispatched = 0;
  const transport: ChatTransport = {
    measureRequest(request) {
      measurements += 1;
      return {
        routeId: measurements === 1 ? "route-a" : "route-b",
        serializedBytes: measure(request).serializedBytes,
      };
    },
    async complete() {
      dispatched += 1;
      return { message: { role: "assistant", content: "unused" } };
    },
  };
  const session = new ChatSession({ model: "fixture/model", transport });
  await assert.rejects(
    () =>
      session.send("route must stay stable", {
        tools: tools({ events: [], pressureBytes: 1 }),
      }),
    /route changed/u,
  );
  assert.equal(dispatched, 0);
});

test("rebuilt request over hard ceiling leaves checkpoint durable but is not adopted or dispatched", async () => {
  let mainDispatches = 0;
  const events: string[] = [];
  const transport: ChatTransport = {
    measureRequest(request) {
      const continuation = request.messages.some(
        (message) =>
          message.role === "user" &&
          String(message.content).startsWith("Untrusted temporary run continuation"),
      );
      return {
        routeId: "fixture-route",
        serializedBytes: continuation ? 500 : 100,
      };
    },
    async complete(request) {
      if (request.options?.maxTokens === 512) return reducerCompletion(request);
      mainDispatches += 1;
      return {
        message: { role: "assistant", content: "" },
        toolCalls: [
          { id: `call-${mainDispatches}`, name: "inspect", arguments: "{}" },
        ],
      };
    },
  };
  const session = new ChatSession({ model: "fixture/model", transport });
  await assert.rejects(
    () =>
      session.send("pressure", {
        tools: tools({
          events,
          pressureBytes: 50,
          maximumBytes: 300,
        }),
      }),
    ChatError,
  );
  assert.equal(mainDispatches, 2);
  assert.ok(events.includes("checkpoint"));
  assert.deepEqual(session.messages, []);
});

test("long tool loop repeatedly compacts older rounds while one raw tail and one logical run survive", async () => {
  const events: string[] = [];
  const checkpointRunIds: string[] = [];
  const mainRequests: ChatRequest[] = [];
  let mainDispatches = 0;
  const transport: ChatTransport = {
    measureRequest: measure,
    async complete(request) {
      if (request.options?.maxTokens === 512) return reducerCompletion(request);
      mainRequests.push(structuredClone(request));
      mainDispatches += 1;
      if (mainDispatches <= 12) {
        return {
          message: { role: "assistant", content: "" },
          toolCalls: [
            { id: `call-${mainDispatches}`, name: "inspect", arguments: "{}" },
          ],
        };
      }
      return { message: { role: "assistant", content: "done" } };
    },
  };
  const session = new ChatSession({ model: "fixture/model", transport });
  await session.send("long run", {
    tools: tools({
      events,
      checkpointRunIds,
      pressureBytes: 1,
      maximumBytes: 100_000,
      maximumCalls: 20,
    }),
  });

  assert.equal(mainDispatches, 13);
  assert.ok(checkpointRunIds.length >= 8);
  assert.equal(new Set(checkpointRunIds).size, 1);
  const projectedAfterPressure = mainRequests.slice(2);
  assert.ok(
    projectedAfterPressure.every(
      (request) =>
        request.messages.filter((message) => message.role === "tool").length <= 1,
    ),
  );
  assert.ok(
    mainRequests.at(-1)!.messages.some(
      (message) =>
        message.role === "user" &&
        String(message.content).includes(RUN_CONTINUATION_STATE_VERSION),
    ),
  );
  assert.deepEqual(
    session.messages.map((message) => message.role),
    ["user", "assistant"],
  );
});
