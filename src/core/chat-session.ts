import { ChatError } from "./errors.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatGenerationOptions,
  ChatImageAttachment,
  ChatMessage,
  ChatTransport,
  ChatTools,
  ChatWireMessage,
} from "./types.js";
import {
  composeChatInvocation,
  validateBudget,
  type ChatInvocationPlan,
} from "./chat-invocation.js";

export interface ChatSessionOptions {
  readonly model: string;
  readonly transport: ChatTransport;
  readonly systemMessage?: string;
  readonly generation?: ChatGenerationOptions;
}

export interface SendMessageOptions extends ChatCallbacks {
  /** Runtime compositions resolve this inside their per-turn settings snapshot. */
  readonly prepareTools?: (
    signal: AbortSignal,
    budgets: import("./runtime-preferences.js").RuntimeBudgets,
  ) => Promise<ChatTools>;
  readonly tools?: ChatTools;
  /** Invocation-local native image input; never enters committed #messages. */
  readonly imageAttachments?: readonly ChatImageAttachment[];
  readonly generation?: ChatGenerationOptions;
  readonly signal?: AbortSignal;
  readonly invocation?: ChatInvocationPlan;
}

export class ChatSession {
  readonly #model: string;
  readonly #transport: ChatTransport;
  readonly #generation: ChatGenerationOptions | undefined;
  #messages: ChatMessage[];

  constructor(options: ChatSessionOptions) {
    this.#model = options.model;
    this.#transport = options.transport;
    this.#generation = options.generation;
    this.#messages = options.systemMessage?.trim()
      ? [{ role: "system", content: options.systemMessage.trim() }]
      : [];
  }

  get model(): string {
    return this.#model;
  }

  get messages(): readonly ChatMessage[] {
    return this.#messages.map((message) => ({ ...message }));
  }

  reset(): void {
    this.#messages = this.#messages.filter(
      (message) => message.role === "system",
    );
  }

  undoLastTurn(): boolean {
    let index = this.#messages.length - 1;
    if (index < 0 || this.#messages[index]?.role !== "assistant") {
      return false;
    }
    index -= 1;
    if (index < 0 || this.#messages[index]?.role !== "user") {
      return false;
    }
    this.#messages = this.#messages.slice(0, index);
    return true;
  }

  async send(
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatCompletion> {
    const normalized = content.trim();
    if (normalized.length === 0) {
      throw new ChatError("configuration", "Message must not be empty.");
    }

    const userMessage: ChatMessage = { role: "user", content: normalized };
    const pendingMessages = [...this.#messages, userMessage];
    const invocation = composeChatInvocation(
      this.#messages,
      normalized,
      options.invocation,
    );
    const generation = {
      ...this.#generation,
      ...options.generation,
    };

    let completion: ChatCompletion;
    const wire: ChatWireMessage[] = [...invocation.messages];
    const tools = options.tools;
    if (
      tools &&
      (!Number.isSafeInteger(tools.maximumCalls) || tools.maximumCalls < 1)
    ) {
      throw new ChatError(
        "configuration",
        "Tool call budget must be a positive integer.",
      );
    }
    let calls = 0;
    const usedIds = new Set<string>();
    for (;;) {
      options.signal?.throwIfAborted();
      if (tools)
        validateBudget(
          options.invocation?.budget,
          JSON.stringify({ messages: wire, tools: tools.definitions }),
        );
      // Stream activity immediately, while committing only the final completion.
      let contentStreamed = false,
        reasoningStreamed = false;
      completion = await this.#transport.complete(
        {
          model: this.#model,
          messages: wire,
          ...(options.imageAttachments?.length
            ? { imageAttachments: options.imageAttachments }
            : {}),
          ...(tools ? { tools: tools.definitions } : {}),
          options: generation,
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        },
        options.onDelta === undefined
          ? undefined
          : {
              onDelta: (delta) => {
                if (delta.type === "content") contentStreamed = true;
                else reasoningStreamed = true;
                options.onDelta?.(delta);
              },
            },
      );
      options.signal?.throwIfAborted();
      if (completion.message.role !== "assistant")
        throw new ChatError(
          "invalid_response",
          "Transport returned a non-assistant completion.",
        );
      if (tools) {
        if (!reasoningStreamed && completion.reasoning)
          options.onDelta?.({ type: "reasoning", text: completion.reasoning });
        if (!contentStreamed && completion.message.content)
          options.onDelta?.({
            type: "content",
            text: completion.message.content,
          });
      }
      if (!completion.toolCalls?.length) {
        break;
      }
      if (completion.finishReason === "length")
        throw new ChatError(
          "invalid_response",
          "Truncated provider tool call; nothing executed.",
        );
      if (!tools)
        throw new ChatError(
          "invalid_response",
          "Provider requested tools that were not offered.",
        );
      if (calls + completion.toolCalls.length > tools.maximumCalls) {
        throw new ChatError(
          "configuration",
          `Tool call budget exceeded (${tools.maximumCalls}). Change it under Global budgets.`,
        );
      }
      for (const call of completion.toolCalls) {
        if (usedIds.has(call.id)) {
          throw new ChatError(
            "invalid_response",
            `Provider returned a duplicate tool call id (${call.id}).`,
          );
        }
        if (!tools.definitions.some((def) => def.name === call.name)) {
          throw new ChatError(
            "invalid_response",
            `Provider requested unavailable tool "${call.name}".`,
          );
        }
        usedIds.add(call.id);
      }
      wire.push({
        role: "assistant",
        content: completion.message.content,
        toolCalls: completion.toolCalls,
        ...(completion.reasoning ? { reasoning: completion.reasoning } : {}),
      });
      for (const call of completion.toolCalls) {
        options.signal?.throwIfAborted();
        const result = await tools.execute(call, options.signal);
        options.signal?.throwIfAborted();
        wire.push({ role: "tool", toolCallId: call.id, content: result });
        calls += 1;
      }
    }
    if (completion.message.role !== "assistant") {
      throw new ChatError(
        "invalid_response",
        "Transport returned a non-assistant completion.",
      );
    }

    this.#messages = [...pendingMessages, { ...completion.message }];
    return completion;
  }
}
