import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ChatError } from "../src/core/errors.js";
import {
  ACME_MODEL_RUNTIME_COMPATIBILITY_PATH,
  ACME_MODEL_RUNTIME_EXECUTE_PATH,
  ACME_MODEL_RUNTIME_HEADER,
  ACME_MODEL_RUNTIME_PROTOCOL,
  AcmeChatError,
  buildAcmeExecuteBody,
} from "../src/providers/acme/acme-model-runtime.js";
import { AcmeChatTransport } from "../src/providers/acme/acme-chat-transport.js";
import type { ChatRequest } from "../src/core/types.js";

const PROTOCOL = ACME_MODEL_RUNTIME_PROTOCOL;
const ENGINE_BUILD = "acme-0176-model-runtime-1";
const BASE = "http://127.0.0.1:8787";

function descriptor() {
  return {
    protocolVersion: PROTOCOL,
    engineBuild: ENGINE_BUILD,
    executePath: ACME_MODEL_RUNTIME_EXECUTE_PATH,
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `event: ${type}\ndata: ${JSON.stringify({ protocolVersion: PROTOCOL, type, ...data })}\n\n`;
}

function sseResponse(events: readonly string[], status = 200): Response {
  return new Response(events.join(""), {
    status,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      [ACME_MODEL_RUNTIME_HEADER]: PROTOCOL,
    },
  });
}

function completed(sequence: number, overrides: Record<string, unknown> = {}): string {
  const response = {
    provider: "openai",
    model: "gpt-5.6-luna",
    receivedAt: "2026-09-15T12:00:00.000Z",
    finishReason: "stop",
    text: "Hello",
    usage: { inputTokens: 4, outputTokens: 2, totalTokens: 6 },
    metadata: { providerStatus: "completed" },
    ...overrides,
  };
  return sseEvent("completed", {
    sequence,
    response,
    result: {
      status: "succeeded",
      modelExecutionId: "model_execution_1",
      replayed: false,
      usage: response.usage,
      diagnostic: { kind: "completed", finishReason: response.finishReason },
      response,
    },
  });
}

function failed(
  sequence: number,
  kind: string,
  error: Record<string, unknown>,
  extras: Record<string, unknown> = {},
): string {
  return sseEvent("failed", {
    sequence,
    error: {
      code: "TIMEOUT",
      message: "failed",
      stage: "calling-model",
      retryable: false,
      ...error,
    },
    result: {
      status: "failed",
      modelExecutionId: "model_execution_fail",
      diagnostic: { kind, ...extras },
    },
  });
}

function fakeAcme(options: {
  readonly onExecute?: (url: string, init?: RequestInit) => Response | Promise<Response>;
  readonly onCompatibility?: () => Response;
  readonly urls?: string[];
}): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
  const urls = options.urls ?? [];
  return async (input, init) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("/v1/execute") && !url.includes(ACME_MODEL_RUNTIME_EXECUTE_PATH)) {
      throw new Error("must not call ACME task runtime");
    }
    if (url.endsWith(ACME_MODEL_RUNTIME_COMPATIBILITY_PATH)) {
      return options.onCompatibility?.() ?? jsonResponse(descriptor());
    }
    if (url.endsWith(ACME_MODEL_RUNTIME_EXECUTE_PATH)) {
      return (
        options.onExecute?.(url, init) ??
        sseResponse([sseEvent("content-delta", { sequence: 0, text: "Hello" }), completed(1)])
      );
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

function transport(
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  extras: Omit<ConstructorParameters<typeof AcmeChatTransport>[0], "fetch"> = {
    baseUrl: BASE,
  },
): AcmeChatTransport {
  return new AcmeChatTransport({
    timeoutMs: 5_000,
    requestKey: () => "req-1",
    fetch,
    ...extras,
    baseUrl: extras.baseUrl ?? BASE,
  });
}

const textRequest: ChatRequest = {
  model: "gpt-5.6-luna",
  messages: [{ role: "user", content: "hi" }],
};

test("compatibility is checked before execute and unexpected versions fail closed", async () => {
  const urls: string[] = [];
  const adapter = transport(
    fakeAcme({
      urls,
      onCompatibility: () =>
        jsonResponse({
          protocolVersion: "acme-model-runtime/2",
          engineBuild: ENGINE_BUILD,
          executePath: ACME_MODEL_RUNTIME_EXECUTE_PATH,
        }),
    }),
  );
  await assert.rejects(
    () => adapter.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.code === "configuration" &&
      error.message.includes("acme-model-runtime/2"),
  );
  assert.deepEqual(urls, [`${BASE}${ACME_MODEL_RUNTIME_COMPATIBILITY_PATH}`]);
});

test("pinned engineBuild is checked before a provider call", async () => {
  const urls: string[] = [];
  const adapter = transport(
    fakeAcme({
      urls,
      onCompatibility: () =>
        jsonResponse({
          protocolVersion: PROTOCOL,
          engineBuild: "other-build",
          executePath: ACME_MODEL_RUNTIME_EXECUTE_PATH,
        }),
    }),
    { baseUrl: BASE, engineBuild: ENGINE_BUILD, timeoutMs: 5_000, requestKey: () => "req-1" },
  );
  await assert.rejects(
    () => adapter.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError && error.message.includes("pinned"),
  );
  assert.equal(urls.some((url) => url.endsWith(ACME_MODEL_RUNTIME_EXECUTE_PATH)), false);
});

test("maps prepared A008 text, tools and generation subset onto acme-model-runtime/1", async () => {
  let body = "";
  let protocolHeader = "";
  const adapter = transport(
    fakeAcme({
      onExecute: (_url, init) => {
        body = String(init?.body ?? "");
        protocolHeader = String(
          (init?.headers as Record<string, string>)[ACME_MODEL_RUNTIME_HEADER] ?? "",
        );
        return sseResponse([
          sseEvent("content-delta", { sequence: 0, text: "ok" }),
          completed(1, { text: "ok" }),
        ]);
      },
    }),
  );
  const completion = await adapter.complete({
    model: "gpt-5.6-luna",
    messages: [{ role: "user", content: "hi" }],
    tools: [{ name: "read_file", description: "Read", parameters: { type: "object" } }],
    options: {
      stream: true,
      maxTokens: 128,
      temperature: 0.2,
      topP: 0.9,
      reasoningBudget: 64,
      enableThinking: true,
      seed: 7,
    },
  });
  assert.equal(protocolHeader, PROTOCOL);
  const payload = JSON.parse(body) as Record<string, unknown>;
  assert.equal(payload.protocolVersion, PROTOCOL);
  assert.equal(payload.requestKey, "req-1");
  assert.deepEqual(payload.model, {
    profile: "gpt-5.6-luna",
    modelHint: "gpt-5.6-luna",
    providerHint: "openai",
  });
  const acmeRequest = payload.request as Record<string, unknown>;
  assert.deepEqual(acmeRequest.output, { mode: "text" });
  assert.equal(acmeRequest.maxOutputTokens, 128);
  assert.equal(acmeRequest.temperature, 0.2);
  assert.equal(Object.hasOwn(acmeRequest, "topP"), false);
  assert.equal(Object.hasOwn(acmeRequest, "reasoningBudget"), false);
  assert.equal(Object.hasOwn(acmeRequest, "enableThinking"), false);
  assert.equal(Object.hasOwn(acmeRequest, "seed"), false);
  assert.deepEqual(payload.requiredCapabilities, { tools: true });
  assert.equal(JSON.stringify(payload).includes("NVIDIA_API_KEY"), false);
  assert.equal(completion.message.content, "ok");
  assert.equal(completion.execution?.id, "model_execution_1");
});

test("streams reasoning and content and maps assembled tool calls", async () => {
  const deltas: Array<{ type: string; text: string }> = [];
  const adapter = transport(
    fakeAcme({
      onExecute: () =>
        sseResponse([
          sseEvent("reasoning-delta", { sequence: 0, text: "think " }),
          sseEvent("reasoning-delta", { sequence: 1, text: "more" }),
          sseEvent("tool-call-delta", {
            sequence: 2,
            index: 0,
            toolCallId: "call_1",
            name: "get_weather",
            argumentsDelta: "{\"city\":",
          }),
          sseEvent("tool-call-delta", {
            sequence: 3,
            index: 0,
            argumentsDelta: "\"Paris\"}",
          }),
          completed(4, {
            text: "",
            finishReason: "tool",
            toolCalls: [
              { toolCallId: "call_1", name: "get_weather", arguments: { city: "Paris" } },
            ],
          }),
        ]),
    }),
  );
  const result = await adapter.complete(
    {
      model: "gpt-5.6-luna",
      messages: [{ role: "user", content: "weather" }],
      tools: [
        {
          name: "get_weather",
          description: "Weather",
          parameters: { type: "object" },
        },
      ],
    },
    { onDelta: (delta) => deltas.push(delta) },
  );
  assert.deepEqual(deltas, [
    { type: "reasoning", text: "think " },
    { type: "reasoning", text: "more" },
  ]);
  assert.equal(result.message.content, "");
  assert.equal(result.finishReason, "tool_calls");
  assert.deepEqual(result.toolCalls, [
    { id: "call_1", name: "get_weather", arguments: "{\"city\":\"Paris\"}" },
  ]);
});

test("tool-result continuation is a later bounded execute and never a task runtime call", async () => {
  const urls: string[] = [];
  const bodies: unknown[] = [];
  const adapter = transport(
    fakeAcme({
      urls,
      onExecute: (_url, init) => {
        bodies.push(JSON.parse(String(init?.body ?? "")));
        return sseResponse([
          sseEvent("content-delta", { sequence: 0, text: "18C" }),
          completed(1, { text: "18C" }),
        ]);
      },
    }),
  );
  const result = await adapter.complete({
    model: "gpt-5.6-luna",
    messages: [
      { role: "user", content: "weather?" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "call_1", name: "get_weather", arguments: "{\"city\":\"Paris\"}" },
        ],
      },
      { role: "tool", toolCallId: "call_1", content: "{\"celsius\":18}" },
    ],
  });
  assert.equal(result.message.content, "18C");
  assert.equal(urls.some((url) => url.endsWith("/v1/execute") && !url.endsWith("/v1/model/execute")), false);
  const request = (bodies[0] as { request: { messages: unknown[] } }).request;
  assert.deepEqual(request.messages[1], {
    role: "assistant",
    content: [
      {
        type: "tool-call",
        toolCallId: "call_1",
        name: "get_weather",
        arguments: { city: "Paris" },
      },
    ],
  });
  assert.deepEqual(request.messages[2], {
    role: "tool",
    content: [
      { type: "tool-result", toolCallId: "call_1", value: { celsius: 18 } },
    ],
  });
});

test("empty usable answer is a typed failure with execution evidence", async () => {
  const adapter = transport(
    fakeAcme({
      onExecute: () => sseResponse([completed(0, { text: "", toolCalls: undefined })]),
    }),
  );
  await assert.rejects(
    () => adapter.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.code === "invalid_response" &&
      error.modelExecutionId === "model_execution_1" &&
      error.message.includes("no usable answer"),
  );
});

test("truncated tool stream fails closed without a complete call", async () => {
  const adapter = transport(
    fakeAcme({
      onExecute: () =>
        sseResponse([
          sseEvent("tool-call-delta", {
            sequence: 0,
            index: 0,
            toolCallId: "call_1",
            name: "get_weather",
            argumentsDelta: "{\"city\":",
          }),
        ]),
    }),
  );
  await assert.rejects(
    () => adapter.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.code === "invalid_response" &&
      error.diagnosticKind === "truncated-stream" &&
      error.retryable === false,
  );
});

test("mid-stream disconnect is truncated evidence and is not retried", async () => {
  const adapter = transport(
    fakeAcme({
      onExecute: () =>
        sseResponse([sseEvent("content-delta", { sequence: 0, text: "Hel" })]),
    }),
  );
  await assert.rejects(
    () => adapter.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.diagnosticKind === "truncated-stream" &&
      error.delivery === "unknown" &&
      error.retryable === false,
  );
});

test("timeout after execute dispatch is non-retryable", async () => {
  const adapter = transport(
    async (input, init) => {
      const url = String(input);
      if (url.endsWith(ACME_MODEL_RUNTIME_COMPATIBILITY_PATH)) {
        return jsonResponse(descriptor());
      }
      return await new Promise<Response>((_resolve, reject) => {
        const abort = (): void => {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        };
        if (init?.signal?.aborted) {
          abort();
          return;
        }
        init?.signal?.addEventListener("abort", abort, { once: true });
      });
    },
    { baseUrl: BASE, timeoutMs: 20, requestKey: () => "req-1" },
  );
  await assert.rejects(
    () => adapter.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.code === "timeout" &&
      error.retryable === false &&
      error.delivery === "unknown",
  );
});

test("cancellation propagates to the ACME execute fetch", async () => {
  const controller = new AbortController();
  let executeSignal: AbortSignal | undefined;
  const adapter = transport(async (input, init) => {
    const url = String(input);
    if (url.endsWith(ACME_MODEL_RUNTIME_COMPATIBILITY_PATH)) {
      return jsonResponse(descriptor());
    }
    executeSignal = init?.signal ?? undefined;
    return await new Promise<Response>((_resolve, reject) => {
      const abort = (): void => {
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      };
      if (init?.signal?.aborted) {
        abort();
        return;
      }
      init?.signal?.addEventListener("abort", abort, { once: true });
      controller.abort();
    });
  });
  await assert.rejects(
    () => adapter.complete({ ...textRequest, signal: controller.signal }),
    (error: unknown) => error instanceof AcmeChatError && error.code === "cancelled",
  );
  assert.equal(executeSignal?.aborted, true);
});

test("provider 429/5xx and malformed terminal data keep ACME evidence", async () => {
  const rate = transport(
    fakeAcme({
      onExecute: () =>
        sseResponse([
          failed(0, "rate-limit", {
            code: "RATE_LIMIT",
            message: "slow down",
            details: { httpStatus: 429 },
          }, { httpStatus: 429 }),
        ]),
    }),
  );
  await assert.rejects(
    () => rate.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.code === "rate_limit" &&
      error.modelExecutionId === "model_execution_fail" &&
      error.message.includes("diagnostic=rate-limit"),
  );

  const server = transport(
    fakeAcme({
      onExecute: () =>
        sseResponse([
          failed(0, "provider-http", {
            code: "PROVIDER_ERROR",
            message: "upstream 503",
          }, { httpStatus: 503, delivery: "sent" }),
        ]),
    }),
  );
  await assert.rejects(
    () => server.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.code === "server" &&
      error.retryable === false &&
      error.delivery === "sent",
  );

  const malformed = transport(
    fakeAcme({
      onExecute: () =>
        sseResponse([
          failed(0, "malformed-stream", {
            code: "MODEL_INVALID_RESPONSE",
            message: "bad json",
          }),
        ]),
    }),
  );
  await assert.rejects(
    () => malformed.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError && error.code === "invalid_response",
  );
});

test("ambiguous delivery after dispatch never falls back to a direct provider", async () => {
  const urls: string[] = [];
  const adapter = transport(
    fakeAcme({
      urls,
      onExecute: () =>
        sseResponse([
          failed(0, "ambiguous-delivery", {
            code: "TIMEOUT",
            message: "The provider may have executed this call; no response was received.",
            details: { delivery: "unknown", reason: "timeout" },
          }, { delivery: "unknown" }),
        ]),
    }),
  );
  await assert.rejects(
    () => adapter.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.code === "provider" &&
      error.retryable === false &&
      error.delivery === "unknown",
  );
  assert.equal(urls.some((url) => url.includes("openai.com")), false);
  assert.equal(urls.some((url) => url.includes("nvidia.com")), false);
  assert.equal(urls.some((url) => url.includes("kie.ai")), false);
  assert.equal(urls.some((url) => url.endsWith("/v1/execute")), false);
});

test("transport refusal is not an engine terminal and does not dispatch twice", async () => {
  const urls: string[] = [];
  const adapter = transport(
    fakeAcme({
      urls,
      onExecute: () =>
        jsonResponse(
          {
            protocolVersion: "acme-model-runtime-error/1",
            code: "MODEL_RUNTIME_PROTOCOL_MISMATCH",
            message: "x-acme-model-runtime-protocol does not match this runtime.",
          },
          409,
        ),
    }),
  );
  await assert.rejects(
    () => adapter.complete(textRequest),
    (error: unknown) =>
      error instanceof AcmeChatError &&
      error.code === "configuration" &&
      error.protocolCode === "MODEL_RUNTIME_PROTOCOL_MISMATCH" &&
      error.delivery === "not-sent",
  );
  assert.equal(urls.filter((url) => url.endsWith(ACME_MODEL_RUNTIME_EXECUTE_PATH)).length, 1);
});

test("ACME token is a composition header and is not copied into model content", async () => {
  let authorization = "";
  let body = "";
  const adapter = transport(
    fakeAcme({
      onExecute: (_url, init) => {
        authorization = String(
          (init?.headers as Record<string, string>).authorization ?? "",
        );
        body = String(init?.body ?? "");
        return sseResponse([completed(0)]);
      },
    }),
    { baseUrl: BASE, token: "acme-runtime-secret", timeoutMs: 5_000, requestKey: () => "req-1" },
  );
  await adapter.complete({
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    messages: [{ role: "user", content: "hi" }],
  });
  assert.equal(authorization, "Bearer acme-runtime-secret");
  assert.equal(body.includes("acme-runtime-secret"), false);
  assert.equal(body.includes("NVIDIA_API_KEY"), false);
});

test("buildAcmeExecuteBody omits empty tools and maps NVIDIA model identity", () => {
  const body = buildAcmeExecuteBody(
    {
      model: "nvidia/nemotron-3.5-lightning-30b-a3b",
      messages: [{ role: "system", content: "Be brief." }, { role: "user", content: "Hi" }],
      options: { maxTokens: 32, stop: ["END"] },
    },
    { requestKey: "k", timeoutMs: 180_000 },
  );
  const request = body.request as Record<string, unknown>;
  assert.equal(Object.hasOwn(request, "tools"), false);
  assert.equal(Object.hasOwn(body, "requiredCapabilities"), false);
  assert.deepEqual(body.model, {
    profile: "nvidia/nemotron-3.5-lightning-30b-a3b",
    modelHint: "nvidia/nemotron-3.5-lightning-30b-a3b",
    providerHint: "nvidia",
  });
  assert.deepEqual(request.stop, ["END"]);
});

test("ACME mapping stays out of memory, knowledge and orchestration modules", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
  for (const area of ["memory", "orchestration"]) {
    const stack = [join(root, area)];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!entry.name.endsWith(".ts")) {
          continue;
        }
        const source = readFileSync(full, "utf8");
        assert.equal(
          source.includes("providers/acme"),
          false,
          `${full} must not import ACME mapping`,
        );
        assert.equal(
          source.includes("acme-model-runtime"),
          false,
          `${full} must not mention ACME protocol types`,
        );
      }
    }
  }
});

test("ChatError remains the public failure type", () => {
  const error = new AcmeChatError("provider", "x", {
    evidence: { modelExecutionId: "id", diagnosticKind: "ambiguous-delivery" },
  });
  assert.equal(error instanceof ChatError, true);
});
