import { ChatError, isChatError } from "../../core/errors.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatRequest,
  ChatToolCall,
  ChatTransport,
  ChatUsage,
} from "../../core/types.js";
import { parseSseData } from "../nvidia/sse.js";

export const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

export type OpenAiFetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenAiChatTransportOptions {
  readonly apiKey: string;
  readonly endpoint?: string;
  readonly fetch?: OpenAiFetchLike;
  readonly timeoutMs?: number;
}
interface OpenAiChoice {
  readonly delta?: {
    readonly content?: unknown;
    readonly tool_calls?: unknown;
  };
  readonly message?: {
    readonly content?: unknown;
    readonly tool_calls?: unknown;
  };
  readonly finish_reason?: unknown;
}

interface OpenAiResponse {
  readonly choices?: unknown;
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly completion_tokens?: unknown;
    readonly total_tokens?: unknown;
  } | null;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ChatError("invalid_response", "Invalid OpenAI tool call.");
  }
  return value as Record<string, unknown>;
}
function toolCalls(value: unknown): ChatToolCall[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new ChatError("invalid_response", "OpenAI tool calls must be an array.");
  }
  const ids = new Set<string>();
  return value.map((item) => {
    const call = record(item);
    const fn = record(call.function);
    if (
      call.type !== "function" ||
      typeof call.id !== "string" ||
      call.id.length === 0 ||
      ids.has(call.id) ||
      typeof fn.name !== "string" ||
      fn.name.length === 0 ||
      typeof fn.arguments !== "string"
    ) {
      throw new ChatError("invalid_response", "Invalid or duplicate OpenAI tool call.");
    }
    ids.add(call.id);
    return { id: call.id, name: fn.name, arguments: fn.arguments };
  });
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function usageFrom(response: OpenAiResponse): ChatUsage | undefined {
  const raw = response.usage;
  if (raw == null) return undefined;
  const promptTokens = optionalNumber(raw.prompt_tokens);
  const completionTokens = optionalNumber(raw.completion_tokens);
  const totalTokens = optionalNumber(raw.total_tokens);
  const usage: ChatUsage = {
    ...(promptTokens === undefined ? {} : { promptTokens }),
    ...(completionTokens === undefined ? {} : { completionTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
  };
  return Object.keys(usage).length === 0 ? undefined : usage;
}

function firstChoice(response: OpenAiResponse): OpenAiChoice | undefined {
  if (!Array.isArray(response.choices) || response.choices.length === 0) return undefined;
  const choice = response.choices[0];
  return typeof choice === "object" && choice !== null
    ? (choice as OpenAiChoice)
    : undefined;
}
function parseJson(text: string): OpenAiResponse {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) throw new Error("not object");
    return value as OpenAiResponse;
  } catch (cause) {
    throw new ChatError("invalid_response", "OpenAI returned invalid JSON.", { cause });
  }
}

function buildPayload(request: ChatRequest): Record<string, unknown> {
  const options = request.options ?? {};
  let attachmentUserIndex = -1;
  if (request.imageAttachments?.length) {
    request.messages.forEach((message, index) => { if (message.role === "user") attachmentUserIndex = index; });
    if (attachmentUserIndex < 0) throw new ChatError("configuration", "Native vision requires a user message.");
  }
  const payload: Record<string, unknown> = {
    model: request.model,
    messages: request.messages.map((message, index) =>
      message.role === "tool"
        ? { role: "tool", tool_call_id: message.toolCallId, content: message.content }
        : "toolCalls" in message
          ? {
              role: "assistant",
              content: message.content || null,
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: call.arguments },
              })),
            }
          : index === attachmentUserIndex && message.role === "user"
            ? {
                role: "user",
                content: [
                  { type: "text", text: message.content },
                  ...request.imageAttachments!.map((image) => ({
                    type: "image_url",
                    image_url: { url: image.dataRef },
                  })),
                ],
              }
            : { role: message.role, content: message.content },
    ),
    stream: options.stream ?? true,
  };
  if (request.tools?.length) {
    payload.tools = request.tools.map((tool) => ({ type: "function", function: tool }));
    payload.tool_choice = "auto";
  }
  if (options.maxTokens != null) payload.max_completion_tokens = options.maxTokens;
  // GPT-5.6 Luna Chat Completions rejects function tools with reasoning_effort > none.
  // Keep A008 tools available by lowering only the effective tool-call request.
  const reasoningEffort =
    request.model === "gpt-5.6-luna" && request.tools?.length
      ? "none"
      : options.reasoningEffort;
  if (reasoningEffort != null) payload.reasoning_effort = reasoningEffort;
  if (request.model !== "gpt-5.6-luna" && options.temperature != null) {
    payload.temperature = options.temperature;
  }
  if (options.topP != null) payload.top_p = options.topP;
  if (options.seed != null) payload.seed = options.seed;
  if (options.stop != null) payload.stop = [...options.stop];
  if (payload.stream === true) payload.stream_options = { include_usage: true };
  return payload;
}

function providerErrorDetail(text: string): string | undefined {
  try {
    const parsed = JSON.parse(text) as { readonly error?: { readonly message?: unknown } };
    const message = parsed.error?.message;
    if (typeof message !== "string" || message.trim().length === 0) return undefined;
    return message.replace(/\s+/gu, " ").trim().slice(0, 800);
  } catch {
    return undefined;
  }
}

function httpError(status: number, detail?: string): ChatError {
  if (status === 401 || status === 403) {
    return new ChatError("authentication", `OpenAI authentication failed with HTTP ${status}.`, { status });
  }
  if (status === 429) {
    return new ChatError("rate_limit", "OpenAI rate limit exceeded.", {
      status,
      retryable: true,
    });
  }
  if (status >= 500) {
    return new ChatError("server", `OpenAI server failed with HTTP ${status}.`, {
      status,
      retryable: true,
    });
  }
  return new ChatError(
    "provider",
    detail
      ? `OpenAI request failed with HTTP ${status}: ${detail}`
      : `OpenAI request failed with HTTP ${status}.`,
    { status },
  );
}

function isAbortError(value: unknown): boolean {
  return (
    (value instanceof DOMException && value.name === "AbortError") ||
    (typeof value === "object" && value !== null && "name" in value && value.name === "AbortError")
  );
}

class ToolCallStream {
  readonly calls = new Map<number, {
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>();

  push(value: unknown): void {
    if (value == null) return;
    if (!Array.isArray(value)) {
      throw new ChatError("invalid_response", "Invalid OpenAI tool call stream.");
    }
    for (const item of value) {
      const delta = record(item);
      if (!Number.isSafeInteger(delta.index) || Number(delta.index) < 0) {
        throw new ChatError("invalid_response", "Invalid OpenAI tool call index.");
      }
      const index = Number(delta.index);
      const call = this.calls.get(index) ?? {
        id: "",
        type: "function",
        function: { name: "", arguments: "" },
      };
      if (delta.type !== undefined && delta.type !== "function") {
        throw new ChatError("invalid_response", "Unsupported OpenAI tool type.");
      }
      if (delta.id !== undefined) {
        if (typeof delta.id !== "string") throw new ChatError("invalid_response", "Invalid OpenAI tool id.");
        call.id += delta.id;
      }
      if (delta.function !== undefined) {
        const fn = record(delta.function);
        if (fn.name !== undefined) {
          if (typeof fn.name !== "string") throw new ChatError("invalid_response", "Invalid OpenAI tool name.");
          call.function.name += fn.name;
        }
        if (fn.arguments !== undefined) {
          if (typeof fn.arguments !== "string") throw new ChatError("invalid_response", "Invalid OpenAI tool arguments.");
          call.function.arguments += fn.arguments;
        }
      }
      this.calls.set(index, call);
    }
  }

  finish(): ChatToolCall[] {
    return toolCalls(
      [...this.calls.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, value]) => value),
    );
  }
}

export class OpenAiChatTransport implements ChatTransport {
  readonly #apiKey: string;
  readonly #endpoint: string;
  readonly #fetch: OpenAiFetchLike;
  readonly #timeoutMs: number;

  constructor(options: OpenAiChatTransportOptions) {
    const apiKey = options.apiKey.trim();
    if (apiKey.length === 0) {
      throw new ChatError("configuration", "OPENAI_API_KEY is required for OpenAI chat.");
    }
    this.#apiKey = apiKey;
    this.#endpoint = options.endpoint?.trim() || OPENAI_CHAT_COMPLETIONS_URL;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = options.timeoutMs ?? 120_000;
  }
  async complete(
    request: ChatRequest,
    callbacks: ChatCallbacks = {},
  ): Promise<ChatCompletion> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);
    const cancel = (): void => controller.abort();
    if (request.signal?.aborted) controller.abort();
    else request.signal?.addEventListener("abort", cancel, { once: true });

    try {
      const streaming = request.options?.stream ?? true;
      const response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          accept: streaming ? "text/event-stream" : "application/json",
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(buildPayload(request)),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = providerErrorDetail(await response.text());
        throw httpError(response.status, detail);
      }
      return streaming
        ? await this.#readStreaming(response, callbacks)
        : await this.#readJson(response);
    } catch (cause) {
      if (isChatError(cause)) throw cause;
      if (timedOut) {
        throw new ChatError("timeout", "OpenAI request timed out.", {
          retryable: true,
          cause,
        });
      }
      if (request.signal?.aborted || isAbortError(cause)) {
        throw new ChatError("cancelled", "OpenAI request was cancelled.", { cause });
      }
      throw new ChatError("network", "OpenAI network request failed.", {
        retryable: true,
        cause,
      });
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", cancel);
    }
  }

  async #readStreaming(
    response: Response,
    callbacks: ChatCallbacks,
  ): Promise<ChatCompletion> {
    if (response.body === null) {
      throw new ChatError("invalid_response", "OpenAI streaming response had no body.");
    }
    const toolStream = new ToolCallStream();
    let content = "";
    let finishReason: string | null | undefined;
    let usage: ChatUsage | undefined;
    let sawChoice = false;
    for await (const data of parseSseData(response.body)) {
      if (data.trim() === "[DONE]") break;
      const parsed = parseJson(data);
      usage = usageFrom(parsed) ?? usage;
      const choice = firstChoice(parsed);
      if (choice === undefined) continue;
      sawChoice = true;
      toolStream.push(choice.delta?.tool_calls);
      const delta = optionalString(choice.delta?.content);
      if (delta) {
        content += delta;
        callbacks.onDelta?.({ type: "content", text: delta });
      }
      if (choice.finish_reason === null) finishReason = null;
      else if (typeof choice.finish_reason === "string") finishReason = choice.finish_reason;
    }
    if (!sawChoice) {
      throw new ChatError("invalid_response", "OpenAI stream did not contain a chat choice.");
    }
    const calls = toolStream.calls.size > 0 ? toolStream.finish() : [];
    return {
      message: { role: "assistant", content },
      ...(calls.length > 0 ? { toolCalls: calls } : {}),
      ...(finishReason === undefined ? {} : { finishReason }),
      ...(usage === undefined ? {} : { usage }),
    };
  }

  async #readJson(response: Response): Promise<ChatCompletion> {
    const parsed = parseJson(await response.text());
    const choice = firstChoice(parsed);
    const message = choice?.message;
    const calls = toolCalls(message?.tool_calls);
    const content = optionalString(message?.content) ?? (calls.length > 0 ? "" : undefined);
    if (choice === undefined || content === undefined) {
      throw new ChatError(
        "invalid_response",
        "OpenAI response did not contain assistant text or a tool call.",
      );
    }
    const finishReason =
      choice.finish_reason === null
        ? null
        : typeof choice.finish_reason === "string"
          ? choice.finish_reason
          : undefined;
    const usage = usageFrom(parsed);
    return {
      message: { role: "assistant", content },
      ...(calls.length > 0 ? { toolCalls: calls } : {}),
      ...(finishReason === undefined ? {} : { finishReason }),
      ...(usage === undefined ? {} : { usage }),
    };
  }
}
