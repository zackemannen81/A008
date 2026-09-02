import { ChatError, isChatError } from "../../core/errors.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatGenerationOptions,
  ChatRequest,
  ChatUsage,
  ChatTransport,
} from "../../core/types.js";
import { parseSseData } from "./sse.js";
import {
  NvidiaReasoningNormalizer,
  splitLeakedContent,
} from "./reasoning-normalizer.js";

export const NVIDIA_CHAT_COMPLETIONS_URL =
  "https://integrate.api.nvidia.com/v1/chat/completions";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface NvidiaChatTransportOptions {
  readonly apiKey: string;
  readonly endpoint?: string;
  readonly fetch?: FetchLike;
  readonly timeoutMs?: number;
}

interface NvidiaChoice {
  readonly delta?: {
    readonly content?: unknown;
    readonly reasoning_content?: unknown;
  };
  readonly message?: {
    readonly content?: unknown;
    readonly reasoning_content?: unknown;
  };
  readonly finish_reason?: unknown;
}

interface NvidiaResponse {
  readonly choices?: unknown;
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly completion_tokens?: unknown;
    readonly total_tokens?: unknown;
  };
}

function buildPayload(request: ChatRequest): Record<string, unknown> {
  const options = request.options ?? {};
  const payload: Record<string, unknown> = {
    model: request.model,
    messages: request.messages.map((message) => ({ ...message })),
    stream: options.stream ?? true,
  };

  assignOption(payload, "temperature", options.temperature);
  assignOption(payload, "top_p", options.topP);
  assignOption(payload, "max_tokens", options.maxTokens);
  assignOption(payload, "reasoning_budget", options.reasoningBudget);

  if (options.enableThinking !== undefined) {
    payload.chat_template_kwargs = { enable_thinking: options.enableThinking };
  }

  return payload;
}

function assignOption(
  payload: Record<string, unknown>,
  key: string,
  value: number | undefined,
): void {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function asChoice(value: unknown): NvidiaChoice | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as NvidiaChoice;
}

function firstChoice(response: NvidiaResponse): NvidiaChoice | undefined {
  if (!Array.isArray(response.choices) || response.choices.length === 0) {
    return undefined;
  }
  return asChoice(response.choices[0]);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalFinishReason(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return optionalString(value);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function usageFrom(response: NvidiaResponse): ChatUsage | undefined {
  const raw = response.usage;
  if (raw === undefined) {
    return undefined;
  }

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

function parseJson(text: string): NvidiaResponse {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null) {
      throw new Error("Response root is not an object.");
    }
    return value as NvidiaResponse;
  } catch (cause) {
    throw new ChatError(
      "invalid_response",
      "NVIDIA returned invalid JSON.",
      { cause },
    );
  }
}

function httpError(status: number): ChatError {
  if (status === 401 || status === 403) {
    return new ChatError(
      "authentication",
      `NVIDIA authentication failed with HTTP ${status}.`,
      { status },
    );
  }
  if (status === 429) {
    return new ChatError("rate_limit", "NVIDIA rate limit exceeded.", {
      status,
      retryable: true,
    });
  }
  if (status >= 500) {
    return new ChatError("server", `NVIDIA server failed with HTTP ${status}.`, {
      status,
      retryable: true,
    });
  }
  return new ChatError("provider", `NVIDIA request failed with HTTP ${status}.`, {
    status,
  });
}

function isAbortError(value: unknown): boolean {
  return (
    (value instanceof DOMException && value.name === "AbortError") ||
    (typeof value === "object" &&
      value !== null &&
      "name" in value &&
      value.name === "AbortError")
  );
}

export class NvidiaChatTransport implements ChatTransport {
  readonly #apiKey: string;
  readonly #endpoint: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(options: NvidiaChatTransportOptions) {
    const apiKey = options.apiKey.trim();
    if (apiKey.length === 0) {
      throw new ChatError(
        "configuration",
        "NVIDIA_API_KEY is required for NVIDIA chat.",
      );
    }

    this.#apiKey = apiKey;
    this.#endpoint = options.endpoint ?? NVIDIA_CHAT_COMPLETIONS_URL;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#timeoutMs = options.timeoutMs ?? 60_000;
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
    if (request.signal?.aborted) {
      controller.abort();
    } else {
      request.signal?.addEventListener("abort", cancel, { once: true });
    }

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
        throw httpError(response.status);
      }

      return streaming
        ? await this.#readStreaming(response, callbacks)
        : await this.#readJson(response);
    } catch (cause) {
      if (isChatError(cause)) {
        throw cause;
      }
      if (timedOut) {
        throw new ChatError("timeout", "NVIDIA request timed out.", {
          retryable: true,
          cause,
        });
      }
      if (request.signal?.aborted || isAbortError(cause)) {
        throw new ChatError("cancelled", "NVIDIA request was cancelled.", {
          cause,
        });
      }
      throw new ChatError("network", "NVIDIA network request failed.", {
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
        "NVIDIA streaming response had no body.",
      );
    }

    const normalizer = new NvidiaReasoningNormalizer();
    let finishReason: string | null | undefined;
    let sawChoice = false;

    for await (const data of parseSseData(response.body)) {
      if (data.trim() === "[DONE]") {
        break;
      }

      const parsed = parseJson(data);
      const choice = firstChoice(parsed);
      if (choice === undefined) {
        continue;
      }
      sawChoice = true;

      const reasoningDelta = optionalString(choice.delta?.reasoning_content);
      if (reasoningDelta !== undefined && reasoningDelta.length > 0) {
        for (const delta of normalizer.push("reasoning_content", reasoningDelta)) {
          callbacks.onDelta?.(delta);
        }
      }

      const contentDelta = optionalString(choice.delta?.content);
      if (contentDelta !== undefined && contentDelta.length > 0) {
        for (const delta of normalizer.push("content", contentDelta)) {
          callbacks.onDelta?.(delta);
        }
      }

      finishReason =
        optionalFinishReason(choice.finish_reason) ?? finishReason;
    }

    if (!sawChoice) {
      throw new ChatError(
        "invalid_response",
        "NVIDIA stream did not contain a chat choice.",
      );
    }

    const parts = normalizer.finish();
    for (const delta of parts.tailDeltas) {
      callbacks.onDelta?.(delta);
    }

    return {
      message: { role: "assistant", content: parts.content },
      ...(parts.reasoning.length === 0 ? {} : { reasoning: parts.reasoning }),
      ...(finishReason === undefined ? {} : { finishReason }),
    };
  }

  async #readJson(response: Response): Promise<ChatCompletion> {
    const parsed = parseJson(await response.text());
    const choice = firstChoice(parsed);
    const content = optionalString(choice?.message?.content);
    if (choice === undefined || content === undefined) {
      throw new ChatError(
        "invalid_response",
        "NVIDIA response did not contain assistant text.",
      );
    }

    const rawReasoning = optionalString(choice.message?.reasoning_content) ?? "";
    const split = splitLeakedContent(content);
    const reasoning =
      rawReasoning.length === 0 && split.reasoningLeak.length === 0
        ? undefined
        : `${rawReasoning}${split.reasoningLeak}`;
    const answer =
      rawReasoning.length > 0 || split.reasoningLeak.length > 0
        ? split.answer
        : content;
    const finishReason = optionalFinishReason(choice.finish_reason);
    const usage = usageFrom(parsed);

    return {
      message: { role: "assistant", content: answer },
      ...(reasoning === undefined || reasoning.length === 0
        ? {}
        : { reasoning }),
      ...(finishReason === undefined ? {} : { finishReason }),
      ...(usage === undefined ? {} : { usage }),
    };
  }
}
