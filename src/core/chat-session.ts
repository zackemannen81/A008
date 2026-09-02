import { ChatError } from "./errors.js";
import type {
  ChatCallbacks,
  ChatCompletion,
  ChatGenerationOptions,
  ChatMessage,
  ChatTransport,
} from "./types.js";
import {
  composeChatInvocation,
  type ChatInvocationPlan,
} from "./chat-invocation.js";

export interface ChatSessionOptions {
  readonly model: string;
  readonly transport: ChatTransport;
  readonly systemMessage?: string;
  readonly generation?: ChatGenerationOptions;
}

export interface SendMessageOptions extends ChatCallbacks {
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
    this.#messages = options.systemMessage
      ? [{ role: "system", content: options.systemMessage }]
      : [];
  }

  get model(): string {
    return this.#model;
  }

  get messages(): readonly ChatMessage[] {
    return this.#messages.map((message) => ({ ...message }));
  }

  reset(): void {
    this.#messages = this.#messages.filter((message) => message.role === "system");
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

    const completion = await this.#transport.complete(
      {
        model: this.#model,
        messages: invocation.messages,
        options: generation,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
      options.onDelta === undefined ? undefined : { onDelta: options.onDelta },
    );

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
