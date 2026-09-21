import { randomUUID } from "node:crypto";
import { createChatCompletionsGateway } from "@acme-engine/adapter-model-chat-completions";
import { createFetchTransport } from "@acme-engine/adapter-model-chat-completions/transport-fetch";
import { ChatError, isChatError } from "../../core/errors.js";
import { generationCapabilities } from "../../core/generation-controls.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatRequest,
  ChatToolCall,
  ChatTransport,
  ChatUsage,
  ModelProfile,
} from "../../core/types.js";
import type { UserCatalog, UserChatModel } from "../../core/user-catalog.js";
import { buildAcmeExecuteBody } from "../acme/acme-model-runtime.js";
import {
  assertSupportedCompatibleRoute,
  compatibleChatCompletionsEndpoint,
  type CompatibleExecutionProvider,
} from "./provider-routes.js";

type CompatibleGateway = ReturnType<typeof createChatCompletionsGateway>;
type GatewayGenerate = CompatibleGateway["generate"];
type GatewayRequest = Parameters<GatewayGenerate>[0];
type GatewayContext = Parameters<GatewayGenerate>[1];
type GatewayResponse = Awaited<ReturnType<GatewayGenerate>>;

export interface OpenAiCompatibleChatTransportOptions {
  readonly provider: CompatibleExecutionProvider;
  readonly apiKey: string;
  readonly route: UserChatModel;
  readonly catalog: UserCatalog;
  readonly timeoutMs: number;
  readonly fetch?: typeof globalThis.fetch;
  readonly requestKey?: () => string;
}

function routeFields(route: UserChatModel): {
  readonly baseUrl: string;
  readonly apiStyle: "openai-chat-completions" | "openai-responses";
} {
  if (
    typeof route.baseUrl !== "string" ||
    (route.apiStyle !== "openai-chat-completions" &&
      route.apiStyle !== "openai-responses")
  ) {
    throw new ChatError(
      "configuration",
      `Compatible model ${route.id} is missing persisted route metadata.`,
    );
  }
  return { baseUrl: route.baseUrl, apiStyle: route.apiStyle };
}

function profileFor(route: UserChatModel): ModelProfile {
  return {
    id: route.id,
    name: route.name,
    provider: route.provider,
    executionProvider: route.provider as CompatibleExecutionProvider,
    defaults: {
      temperature: 1,
      topP: 0.95,
      maxTokens: 16_384,
      stream: true,
    },
    inputModalities: route.inputModalities,
  };
}
function gatewayFor(
  options: OpenAiCompatibleChatTransportOptions,
): CompatibleGateway {
  const route = routeFields(options.route);
  const policy = assertSupportedCompatibleRoute({
    provider: options.provider,
    ...route,
  });
  const profile = profileFor(options.route);
  const caps = generationCapabilities(profile.id);
  const selection = {
    profile: profile.id,
    providerHint: policy.provider,
    modelHint: profile.id,
  };
  return createChatCompletionsGateway({
    transport: createFetchTransport({
      fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    }),
    profiles: [
      {
        selection,
        provider: policy.provider,
        model: profile.id,
        endpoint: compatibleChatCompletionsEndpoint(route.baseUrl),
        capabilities: {
          structuredOutput: false,
          tools: true,
          vision: profile.inputModalities.includes("image"),
          maxOutputTokens: caps.maxTokens,
        },
        controls: {
          temperature: true,
          topP: caps.topP,
          maxOutputTokens: true,
          stop: caps.stop,
          reasoningBudget: caps.reasoningBudget !== null,
          enableThinking: caps.thinking ? "enable_thinking" : false,
          reasoningEffort: caps.reasoningEfforts.length > 0,
          seed: caps.seed,
        },
        headers: () => ({
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        }),
      },
    ],
    now: () => new Date().toISOString(),
  });
}

function usageFrom(response: GatewayResponse): ChatUsage | undefined {
  const usage: ChatUsage = {
    ...(response.usage.inputTokens === undefined
      ? {}
      : { promptTokens: response.usage.inputTokens }),
    ...(response.usage.outputTokens === undefined
      ? {}
      : { completionTokens: response.usage.outputTokens }),
    ...(response.usage.totalTokens === undefined
      ? {}
      : { totalTokens: response.usage.totalTokens }),
  };
  return Object.keys(usage).length === 0 ? undefined : usage;
}

function finishReason(value: GatewayResponse["finishReason"]): string {
  if (value === "tool") return "tool_calls";
  if (value === "content-filter") return "content_filter";
  return value;
}

function toolCallsFrom(response: GatewayResponse): ChatToolCall[] {
  return (response.toolCalls ?? []).map((call) => ({
    id: call.toolCallId,
    name: call.name,
    arguments: JSON.stringify(call.arguments),
  }));
}

function completionFrom(response: GatewayResponse): ChatCompletion {
  const toolCalls = toolCallsFrom(response);
  const usage = usageFrom(response);
  return {
    message: { role: "assistant", content: response.text },
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    finishReason: finishReason(response.finishReason),
    ...(usage === undefined ? {} : { usage }),
  };
}
function acmeErrorData(value: unknown):
  | { readonly code: string; readonly message: string; readonly retryable?: boolean }
  | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  const raw =
    typeof candidate.data === "object" &&
    candidate.data !== null &&
    !Array.isArray(candidate.data)
      ? (candidate.data as Record<string, unknown>)
      : candidate;
  if (typeof raw.code !== "string" || typeof raw.message !== "string") {
    return undefined;
  }
  return {
    code: raw.code,
    message: raw.message,
    ...(typeof raw.retryable === "boolean"
      ? { retryable: raw.retryable }
      : {}),
  };
}

function chatErrorFromGateway(value: unknown): ChatError {
  if (isChatError(value)) return value;
  const error = acmeErrorData(value);
  if (error === undefined) {
    return new ChatError(
      "provider",
      value instanceof Error
        ? value.message
        : "OpenAI-compatible provider execution failed.",
      { cause: value },
    );
  }
  const code =
    error.code === "MODEL_AUTH"
      ? "authentication"
      : error.code === "MODEL_RATE_LIMIT"
        ? "rate_limit"
        : error.code === "TIMEOUT"
          ? "timeout"
          : error.code === "CANCELLED"
            ? "cancelled"
            : error.code === "MODEL_INVALID_RESPONSE"
              ? "invalid_response"
              : error.code === "MODEL_UNAVAILABLE"
                ? "server"
                : error.code === "INVALID_REQUEST" ||
                    error.code === "UNSUPPORTED_CAPABILITY"
                  ? "configuration"
                  : "provider";
  return new ChatError(code, error.message, {
    ...(error.retryable === undefined ? {} : { retryable: error.retryable }),
    cause: value,
  });
}
export class OpenAiCompatibleChatTransport implements ChatTransport {
  readonly #options: OpenAiCompatibleChatTransportOptions;
  readonly #requestKey: () => string;

  constructor(options: OpenAiCompatibleChatTransportOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new ChatError(
        "configuration",
        `${options.provider} API key must not be empty.`,
      );
    }
    if (options.route.provider !== options.provider) {
      throw new ChatError(
        "configuration",
        `Compatible route provider mismatch for ${options.route.id}.`,
      );
    }
    routeFields(options.route);
    this.#options = { ...options, apiKey };
    this.#requestKey = options.requestKey ?? randomUUID;
  }

  async complete(
    request: ChatRequest,
    callbacks: ChatCallbacks = {},
  ): Promise<ChatCompletion> {
    if (request.model !== this.#options.route.id) {
      throw new ChatError(
        "configuration",
        `Compatible transport for ${this.#options.route.id} cannot execute ${request.model}.`,
      );
    }
    const envelope = buildAcmeExecuteBody(request, {
      requestKey: this.#requestKey(),
      timeoutMs: this.#options.timeoutMs,
      catalog: this.#options.catalog,
    });
    const modelRequest = envelope.request as GatewayRequest;
    const selection = envelope.model as GatewayContext["selection"];
    const requiredCapabilities =
      (envelope.requiredCapabilities ??
        {}) as GatewayContext["requiredCapabilities"];
    const signal = request.signal ?? new AbortController().signal;
    const context: GatewayContext = {
      executionId: `direct_${this.#requestKey()}`,
      callKey: this.#requestKey(),
      selection,
      requiredCapabilities,
      timeoutMs: this.#options.timeoutMs,
      signal,
    };
    const gateway = gatewayFor(this.#options);

    try {
      if (request.options?.stream === false || gateway.stream === undefined) {
        return completionFrom(await gateway.generate(modelRequest, context));
      }
      let completed: GatewayResponse | undefined;
      let reasoning = "";
      for await (const event of gateway.stream(modelRequest, context)) {
        if (event.type === "reasoning-delta") {
          reasoning += event.text;
          if (event.text) callbacks.onDelta?.({ type: "reasoning", text: event.text });
        } else if (event.type === "content-delta") {
          if (event.text) callbacks.onDelta?.({ type: "content", text: event.text });
        } else if (event.type === "completed") {
          completed = event.response;
        } else if (event.type === "failed") {
          throw event.error;
        }
      }
      if (completed === undefined) {
        throw new ChatError(
          "invalid_response",
          `${this.#options.provider} stream ended without a completed response.`,
        );
      }
      const completion = completionFrom(completed);
      return reasoning ? { ...completion, reasoning } : completion;
    } catch (cause) {
      throw chatErrorFromGateway(cause);
    }
  }
}
