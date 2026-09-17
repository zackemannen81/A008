import { ChatError, isChatError } from "../../core/errors.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatRequest,
  ChatTransport,
  ChatUsage,
} from "../../core/types.js";
import { parseSseData } from "../nvidia/sse.js";
import { kieChatCompletionsUrl } from "./kie-models.js";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface KieChatTransportOptions {
  readonly apiKey: string;
  readonly endpoint?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function firstChoice(parsed: unknown): Record<string, unknown> | undefined {
  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.choices) ||
    parsed.choices.length === 0
  ) {
    return undefined;
  }
  const choice = parsed.choices[0];
  return isRecord(choice) ? choice : undefined;
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return undefined;
  }
}

function usageOf(parsed: unknown): ChatUsage | undefined {
  if (!isRecord(parsed) || !isRecord(parsed.usage)) return undefined;
  const prompt = parsed.usage.prompt_tokens;
  const completion = parsed.usage.completion_tokens;
  const total = parsed.usage.total_tokens;
  return {
    ...(typeof prompt === "number" ? { promptTokens: prompt } : {}),
    ...(typeof completion === "number" ? { completionTokens: completion } : {}),
    ...(typeof total === "number" ? { totalTokens: total } : {}),
  };
}

function isAbortError(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "name" in cause &&
    cause.name === "AbortError"
  );
}

export class KieChatTransport implements ChatTransport {
  readonly #apiKey: string;
  readonly #endpoint: string | undefined;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(options: KieChatTransportOptions) {
    const apiKey = options.apiKey.trim();
    if (apiKey.length === 0) {
      throw new ChatError(
        "configuration",
        "KIE_API_KEY is required for kie.ai chat.",
      );
    }
    this.#apiKey = apiKey;
    this.#endpoint = options.endpoint?.trim() || undefined;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = options.timeoutMs ?? 120_000;
  }

  async complete(
    request: ChatRequest,
    callbacks: ChatCallbacks = {},
  ): Promise<ChatCompletion> {
    if (request.imageAttachments?.length) {
      throw new ChatError(
        "configuration",
        "Native vision is not mapped for the current KIE chat transport.",
      );
    }
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);
    const cancel = (): void => controller.abort();
    if (request.signal?.aborted) controller.abort();
    else request.signal?.addEventListener("abort", cancel, { once: true });
    const endpoint = this.#endpoint ?? kieChatCompletionsUrl(request.model);
    const streaming = request.options?.stream ?? true;
    const options = request.options ?? {};
    const payload: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.map((message) =>
        "toolCallId" in message
          ? {
              role: "tool",
              tool_call_id: message.toolCallId,
              content: message.content,
            }
          : { role: message.role, content: message.content },
      ),
      stream: streaming,
    };
    if (options.temperature != null) payload.temperature = options.temperature;
    if (options.topP != null) payload.top_p = options.topP;
    if (options.maxTokens != null) payload.max_tokens = options.maxTokens;
    try {
      const response = await this.#fetch(endpoint, {
        method: "POST",
        headers: {
          accept: streaming ? "text/event-stream" : "application/json",
          authorization: `Bearer ${this.#apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const raw = streaming ? undefined : await response.text();
      if (!response.ok) {
        throw new ChatError(
          "provider",
          `kie.ai chat failed (${response.status}).`,
        );
      }
      if (streaming) return await this.#readStreaming(response, callbacks);
      return this.#readJson(raw ?? "");
    } catch (cause) {
      if (isChatError(cause)) throw cause;
      if (timedOut) {
        throw new ChatError("timeout", "kie.ai request timed out.", {
          retryable: true,
          cause,
        });
      }
      if (request.signal?.aborted || isAbortError(cause)) {
        throw new ChatError("cancelled", "kie.ai request was cancelled.", {
          cause,
        });
      }
      throw new ChatError("network", "kie.ai network request failed.", {
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
      throw new ChatError(
        "invalid_response",
        "kie.ai streaming response had no body.",
      );
    }
    let content = "";
    let finishReason: string | null | undefined;
    let usage: ChatUsage | undefined;
    for await (const data of parseSseData(response.body)) {
      if (data.trim() === "[DONE]") break;
      const parsed = parseJson(data);
      const choice = firstChoice(parsed);
      if (choice === undefined) continue;
      const delta = isRecord(choice.delta)
        ? optionalString(choice.delta.content)
        : undefined;
      if (delta) {
        content += delta;
        callbacks.onDelta?.({ type: "content", text: delta });
      }
      if (typeof choice.finish_reason === "string")
        finishReason = choice.finish_reason;
      usage = usageOf(parsed) ?? usage;
    }
    return completionOf(content, finishReason, usage);
  }

  #readJson(raw: string): ChatCompletion {
    const parsed = parseJson(raw);
    if (
      isRecord(parsed) &&
      parsed.code !== undefined &&
      parsed.code !== 200 &&
      firstChoice(parsed) === undefined
    ) {
      throw new ChatError(
        "provider",
        typeof parsed.msg === "string" ? parsed.msg : "kie.ai chat failed.",
      );
    }
    const choice = firstChoice(parsed);
    const message =
      choice && isRecord(choice.message) ? choice.message : undefined;
    const content = optionalString(message?.content) ?? "";
    const finishReason =
      typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
    return completionOf(content, finishReason, usageOf(parsed));
  }
}

function completionOf(
  content: string,
  finishReason: string | null | undefined,
  usage: ChatUsage | undefined,
): ChatCompletion {
  return {
    message: { role: "assistant", content },
    ...(finishReason === undefined ? {} : { finishReason }),
    ...(usage === undefined ? {} : { usage }),
  };
}
