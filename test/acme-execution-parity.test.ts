import assert from "node:assert/strict";
import test from "node:test";
import { ChatSession } from "../src/core/chat-session.js";
import { Utf8ByteChatMessageMeasurer } from "../src/core/chat-invocation.js";
import { ChatError } from "../src/core/errors.js";
import type {
  ChatCompletion,
  ChatRequest,
  ChatToolCall,
  ChatTransport,
} from "../src/core/types.js";
import {
  ACME_MODEL_RUNTIME_COMPATIBILITY_PATH,
  ACME_MODEL_RUNTIME_EXECUTE_PATH,
  ACME_MODEL_RUNTIME_HEADER,
  ACME_MODEL_RUNTIME_PROTOCOL,
} from "../src/providers/acme/acme-model-runtime.js";
import { AcmeChatTransport } from "../src/providers/acme/acme-chat-transport.js";
import { ChatTransportSemanticJsonGenerator } from "../src/orchestration/semantic-json-model.js";
import { createLocalMemoryRuntime } from "../src/runtime/local-memory-runtime.js";
import {
  createConfiguredChatTransport,
  usesAcmeChat,
} from "../src/runtime/chat-dispatch.js";
import { parseLocalRuntimeConfig } from "../src/runtime/local-runtime-config.js";
import {
  isolatedMemoryEnv,
  semanticOperation,
  TEST_PROJECT_ID,
} from "./helpers.js";

const PROTOCOL = ACME_MODEL_RUNTIME_PROTOCOL;
const BASE = "http://127.0.0.1:8787";

type Normalized = {
  readonly content: string;
  readonly reasoning?: string;
  readonly toolCalls?: readonly ChatToolCall[];
  readonly finishReason?: string;
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify({ protocolVersion: PROTOCOL, type, ...data })}\n\n`;
}

function sseResponse(events: readonly string[]): Response {
  return new Response(events.join(""), {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      [ACME_MODEL_RUNTIME_HEADER]: PROTOCOL,
    },
  });
}

function lastPlainText(request: ChatRequest): string {
  for (let index = request.messages.length - 1; index >= 0; index -= 1) {
    const message = request.messages[index];
    if (message && message.role !== "tool" && !("toolCalls" in message)) {
      return message.content;
    }
  }
  return "";
}

function hasToolResult(request: ChatRequest): boolean {
  return request.messages.some((message) => message.role === "tool");
}

function acmeFetch(
  complete: (request: ChatRequest) => Normalized,
): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const url = String(input);
    assert.equal(
      url.includes("/v1/execute") && !url.includes("/v1/model/execute"),
      false,
      "A008 must not call ACME /v1/execute",
    );
    assert.equal(url.includes("api.openai.com"), false);
    assert.equal(url.includes("integrate.api.nvidia.com"), false);
    assert.equal(url.includes("api.kie.ai"), false);
    if (url.endsWith(ACME_MODEL_RUNTIME_COMPATIBILITY_PATH)) {
      return jsonResponse({
        protocolVersion: PROTOCOL,
        engineBuild: "parity",
        executePath: ACME_MODEL_RUNTIME_EXECUTE_PATH,
      });
    }
    const body = JSON.parse(String(init?.body ?? "")) as {
      readonly request: {
        readonly messages: Array<{
          readonly role: "system" | "user" | "assistant" | "tool";
          readonly content: readonly Record<string, unknown>[];
        }>;
      };
    };
    const mapped: ChatRequest = {
      model: "gpt-5.6-luna",
      messages: body.request.messages.map((message) => {
        if (message.role === "tool") {
          const part = message.content[0] as {
            readonly toolCallId: string;
            readonly value: unknown;
          };
          return {
            role: "tool" as const,
            toolCallId: part.toolCallId,
            content: JSON.stringify(part.value),
          };
        }
        const toolCalls = message.content
          .filter((part) => part.type === "tool-call")
          .map((part) => ({
            id: String(part.toolCallId),
            name: String(part.name),
            arguments: JSON.stringify(part.arguments),
          }));
        const text = message.content
          .filter((part) => part.type === "text")
          .map((part) => String(part.text))
          .join("");
        if (toolCalls.length > 0) {
          return { role: "assistant" as const, content: text, toolCalls };
        }
        return { role: message.role as "system" | "user" | "assistant", content: text };
      }),
    };
    const result = complete(mapped);
    const events: string[] = [];
    let sequence = 0;
    if (result.reasoning) {
      events.push(sseEvent("reasoning-delta", { sequence, text: result.reasoning }));
      sequence += 1;
    }
    if (result.content) {
      events.push(sseEvent("content-delta", { sequence, text: result.content }));
      sequence += 1;
    }
    const finishReason = result.finishReason ?? (result.toolCalls ? "tool" : "stop");
    const response = {
      provider: "openai",
      model: "gpt-5.6-luna",
      receivedAt: "2026-09-15T12:00:00.000Z",
      text: result.content,
      finishReason: finishReason === "tool_calls" ? "tool" : finishReason,
      usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
      metadata: {},
      ...(result.toolCalls
        ? {
            toolCalls: result.toolCalls.map((call) => ({
              toolCallId: call.id,
              name: call.name,
              arguments: JSON.parse(call.arguments) as unknown,
            })),
          }
        : {}),
    };
    events.push(
      sseEvent("completed", {
        sequence,
        response,
        result: {
          status: "succeeded",
          modelExecutionId: "model_execution_parity",
          replayed: false,
          usage: response.usage,
          diagnostic: { kind: "completed", finishReason: response.finishReason },
          response,
        },
      }),
    );
    return sseResponse(events);
  };
}

function acmeTransport(complete: (request: ChatRequest) => Normalized): AcmeChatTransport {
  return new AcmeChatTransport({
    baseUrl: BASE,
    timeoutMs: 5_000,
    requestKey: () => "parity-key",
    fetch: acmeFetch(complete),
  });
}

function directTransport(complete: (request: ChatRequest) => Normalized): ChatTransport {
  return {
    async complete(request, callbacks) {
      const result = complete(request);
      if (result.reasoning) {
        callbacks?.onDelta?.({ type: "reasoning", text: result.reasoning });
      }
      if (result.content) {
        callbacks?.onDelta?.({ type: "content", text: result.content });
      }
      return {
        message: { role: "assistant", content: result.content },
        ...(result.reasoning === undefined ? {} : { reasoning: result.reasoning }),
        ...(result.toolCalls === undefined ? {} : { toolCalls: result.toolCalls }),
        finishReason: result.finishReason ?? (result.toolCalls ? "tool_calls" : "stop"),
        usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
      };
    },
  };
}

function visible(completion: ChatCompletion) {
  return {
    content: completion.message.content,
    finishReason: completion.finishReason,
    toolCalls: completion.toolCalls,
    usage: completion.usage,
    reasoning: completion.reasoning,
  };
}

test("direct and ACME text, reasoning, tool call and tool-result continuation match", async () => {
  const script = (request: ChatRequest): Normalized => {
    if (hasToolResult(request)) {
      return { content: "Paris is 18C." };
    }
    if (lastPlainText(request).includes("weather")) {
      return {
        content: "",
        toolCalls: [
          { id: "call_1", name: "get_weather", arguments: "{\"city\":\"Paris\"}" },
        ],
        finishReason: "tool_calls",
      };
    }
    return { content: "Hello there.", reasoning: "private" };
  };
  const executed: string[] = [];
  const tools = {
    definitions: [
      { name: "get_weather", description: "Weather", parameters: { type: "object" } },
    ],
    maximumCalls: 2,
    async execute(call: ChatToolCall) {
      executed.push(`${call.id}:${call.name}:${call.arguments}`);
      return "{\"celsius\":18}";
    },
  };
  const directDeltas: string[] = [];
  const acmeDeltas: string[] = [];
  const directSession = new ChatSession({
    model: "gpt-5.6-luna",
    transport: directTransport(script),
  });
  const acmeSession = new ChatSession({
    model: "gpt-5.6-luna",
    transport: acmeTransport(script),
  });

  const directHello = await directSession.send("hi", {
    onDelta: (delta) => directDeltas.push(`${delta.type}:${delta.text}`),
  });
  const acmeHello = await acmeSession.send("hi", {
    onDelta: (delta) => acmeDeltas.push(`${delta.type}:${delta.text}`),
  });
  assert.deepEqual(visible(directHello), {
    content: "Hello there.",
    finishReason: "stop",
    toolCalls: undefined,
    usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
    reasoning: "private",
  });
  assert.equal(acmeHello.message.content, directHello.message.content);
  assert.equal(acmeHello.finishReason, "stop");
  assert.deepEqual(directDeltas, acmeDeltas);
  assert.equal(acmeHello.execution?.id, "model_execution_parity");

  const directWeather = await directSession.send("weather in Paris", { tools });
  const acmeWeather = await acmeSession.send("weather in Paris", { tools });
  assert.equal(directWeather.message.content, "Paris is 18C.");
  assert.equal(acmeWeather.message.content, directWeather.message.content);
  assert.deepEqual(directSession.messages, acmeSession.messages);
  assert.deepEqual(executed, [
    "call_1:get_weather:{\"city\":\"Paris\"}",
    "call_1:get_weather:{\"city\":\"Paris\"}",
  ]);
});

test("fragmented ACME tool calls are not executed until structurally complete", async () => {
  const session = new ChatSession({
    model: "gpt-5.6-luna",
    transport: acmeTransport(() => ({
      content: "",
      toolCalls: [
        { id: "call_1", name: "get_weather", arguments: "{\"city\":\"Paris\"}" },
      ],
      finishReason: "length",
    })),
  });
  let executed = 0;
  await assert.rejects(
    () =>
      session.send("weather", {
        tools: {
          definitions: [
            { name: "get_weather", description: "Weather", parameters: { type: "object" } },
          ],
          maximumCalls: 2,
          async execute() {
            executed += 1;
            return "{}";
          },
        },
      }),
    (error: unknown) =>
      error instanceof ChatError &&
      error.code === "invalid_response" &&
      error.message.includes("Truncated provider tool call"),
  );
  assert.equal(executed, 0);
  assert.equal(session.messages.length, 0);
});

test("stateless semantic JSON matches through direct and ACME transports", async () => {
  const script = (request: ChatRequest): Normalized => {
    if (semanticOperation(request) === "knowledge_analysis") {
      return { content: '[{"proposition":"The box is blue.","kind":"fact"}]' };
    }
    return { content: "{}" };
  };
  const generator = (transport: ChatTransport) =>
    new ChatTransportSemanticJsonGenerator({
      transport,
      model: "gpt-5.6-luna",
      budget: { maximum: 10_000, measurer: new Utf8ByteChatMessageMeasurer() },
    });
  const input = {
    operation: "knowledge_analysis" as const,
    systemInstruction: "Return strict JSON only.",
    serializedInput: '{"message":"The box is blue.","answer":"Noted."}',
  };
  const direct = await generator(directTransport(script)).generate(input);
  const acme = await generator(acmeTransport(script)).generate(input);
  assert.deepEqual(direct, acme);
});

test("direct and ACME local runtimes commit equivalent chat and knowledge", async () => {
  const ASSERTION = "Durable fact: the local memory project code is alpha-seven.";
  const PROPOSITION = "the local memory project code is alpha-seven";
  const QUESTION = "What is the local memory project code?";

  async function run(kind: "direct" | "acme") {
    let chatTurn = 0;
    const complete = (request: ChatRequest): Normalized => {
      const operation = semanticOperation(request);
      if (operation === "retrieval_scope") {
        return { content: '{"domains":[],"relatedDomains":[]}' };
      }
      if (operation === "knowledge_analysis") {
        const content = request.messages.at(-1)?.content ?? "";
        if (content.includes(ASSERTION)) {
          return {
            content: JSON.stringify([
              {
                severity: "important",
                proposition: PROPOSITION,
                kind: "fact",
                tags: ["memory"],
                domains: ["runtime"],
                entities: ["alpha-seven"],
                confidence: 0.99,
              },
            ]),
          };
        }
        return { content: "[]" };
      }
      if (operation === "relation_classification") {
        return { content: '{"type":"new"}' };
      }
      chatTurn += 1;
      return {
        content:
          chatTurn === 1
            ? "Noted."
            : "The local memory project code is alpha-seven.",
        reasoning: "PRIVATE_RUNTIME_REASONING",
      };
    };
    const isolated = isolatedMemoryEnv(
      kind === "acme"
        ? {
            NVIDIA_API_KEY: "",
            A008_CHAT_TRANSPORT: "acme",
            A008_ACME_MODEL_RUNTIME_URL: BASE,
          }
        : {},
    );
    const runtime = createLocalMemoryRuntime({
      env: isolated.env,
      surface: "test",
      ...(kind === "direct"
        ? { createTransport: () => directTransport(complete) }
        : { fetch: acmeFetch(complete) }),
    });
    try {
      const session = runtime.openSession();
      const first = await session.turn(ASSERTION);
      const second = await session.turn(QUESTION);
      const inspection = runtime.inspectMemory();
      return {
        firstContent: first.completion.message.content,
        secondContent: second.completion.message.content,
        postOutput: [first.postOutput.status, second.postOutput.status],
        selected: second.memory.evidence.selectedKnowledgeIds.length,
        projected: second.memory.projection.projection.items.map((item) => ({
          kind: item.kind,
          proposition: item.proposition,
        })),
        inspectionCounts: inspection.summary.counts,
      };
    } finally {
      runtime.close();
    }
  }

  const direct = await run("direct");
  const acme = await run("acme");
  assert.deepEqual(direct, acme);
  assert.equal(direct.firstContent, "Noted.");
  assert.match(direct.secondContent, /alpha-seven/u);
});

test("Luna semantic retrieval and extraction omit unsupported temperature through ACME", async () => {
  const semanticRequests: Array<Record<string, unknown>> = [];
  const semanticOperations: string[] = [];
  const baseFetch = acmeFetch((request) => {
    const operation = semanticOperation(request);
    if (operation) semanticOperations.push(operation);
    return {
      content: operation === "retrieval_scope"
        ? '{"domains":[],"relatedDomains":[],"tags":[],"relatedTags":[]}'
        : operation === "knowledge_analysis" ? "[]" : "Luna answer.",
    };
  });
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith(ACME_MODEL_RUNTIME_EXECUTE_PATH)) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { request?: Record<string, unknown> };
      const request = body.request ?? {};
      const serialized = JSON.stringify(request);
      if (serialized.includes("retrieval_scope") ||
          serialized.includes("knowledge_analysis")) {
        semanticRequests.push(request);
      }
    }
    return baseFetch(input, init);
  };
  const isolated = isolatedMemoryEnv({
    NVIDIA_API_KEY: "",
    OPENAI_API_KEY: "sk-openai-fixture",
    A008_CHAT_TRANSPORT: "acme",
    A008_ACME_MODEL_RUNTIME_URL: BASE,
  });
  const runtime = createLocalMemoryRuntime({ env: isolated.env, surface: "test", fetch });
  try {
    const result = await runtime.openSession({ model: "gpt-5.6-luna" }).turn("hello");
    assert.equal(result.completion.message.content, "Luna answer.");
    assert.equal(result.postOutput.status, "completed");
    assert.deepEqual(semanticOperations, ["retrieval_scope", "knowledge_analysis"]);
    assert.equal(semanticRequests.length, 2);
    assert.equal(semanticRequests.every(request => !Object.hasOwn(request, "temperature")), true);
  } finally {
    runtime.close();
  }
});

test("explicit ACME composition does not require provider keys and does not default on", () => {
  const direct = parseLocalRuntimeConfig(
    { A008_PROJECT_ID: TEST_PROJECT_ID },
    { surface: "cli" },
  );
  assert.equal(direct.chatTransport.mode, "direct");
  assert.equal(usesAcmeChat(direct.chatTransport), false);

  const acme = parseLocalRuntimeConfig(
    {
      A008_PROJECT_ID: TEST_PROJECT_ID,
      A008_CHAT_TRANSPORT: "acme",
      A008_ACME_MODEL_RUNTIME_URL: BASE,
      A008_ACME_ENGINE_BUILD: "parity",
    },
    { surface: "cli" },
  );
  assert.equal(acme.chatTransport.mode, "acme");
  assert.equal(acme.chatTransport.baseUrl, BASE);
  assert.equal(acme.chatTransport.engineBuild, "parity");

  const urls: string[] = [];
  const transport = createConfiguredChatTransport({
    env: {},
    catalogPath: "unused",
    timeoutMs: 5_000,
    acme: acme.chatTransport,
    fetch: async (input) => {
      urls.push(String(input));
      const url = String(input);
      if (url.endsWith(ACME_MODEL_RUNTIME_COMPATIBILITY_PATH)) {
        return jsonResponse({
          protocolVersion: PROTOCOL,
          engineBuild: "parity",
          executePath: ACME_MODEL_RUNTIME_EXECUTE_PATH,
        });
      }
      return sseResponse([
        sseEvent("content-delta", { sequence: 0, text: "ok" }),
        sseEvent("completed", {
          sequence: 1,
          response: {
            provider: "openai",
            model: "gpt-5.6-luna",
            receivedAt: "2026-09-15T12:00:00.000Z",
            finishReason: "stop",
            text: "ok",
            usage: {},
            metadata: {},
          },
          result: {
            status: "succeeded",
            modelExecutionId: "model_execution_compose",
            replayed: false,
            usage: {},
            diagnostic: { kind: "completed", finishReason: "stop" },
            response: { text: "ok" },
          },
        }),
      ]);
    },
  });
  return transport
    .complete({ model: "gpt-5.6-luna", messages: [{ role: "user", content: "hi" }] })
    .then((completion) => {
      assert.equal(completion.message.content, "ok");
      assert.equal(urls.some((url) => url.includes("openai.com")), false);
    });
});
