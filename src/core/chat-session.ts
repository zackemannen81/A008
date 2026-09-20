import { ChatError } from "./errors.js";
import {
  cloneChatMessage,
  generatedImageMessage,
  generatedImagePart,
  updateGeneratedImageMessage,
  type GeneratedImageTerminalUpdate,
} from "./chat-content.js";
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
  readonly prepareTools?: (
    signal: AbortSignal,
    budgets: import("./runtime-preferences.js").RuntimeBudgets,
  ) => Promise<ChatTools>;
  readonly tools?: ChatTools;
  /** Invocation-local native image input; never enters committed history. */
  readonly imageAttachments?: readonly ChatImageAttachment[];
  readonly generation?: ChatGenerationOptions;
  readonly signal?: AbortSignal;
  readonly invocation?: ChatInvocationPlan;
}

interface ActiveConversation {
  readonly userMessage: ChatMessage;
  readonly imageMessages: ChatMessage[];
}

export class ChatSession {
  readonly #model: string;
  readonly #transport: ChatTransport;
  readonly #generation: ChatGenerationOptions | undefined;
  #messages: ChatMessage[];
  #activeConversation: ActiveConversation | undefined;

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
    const messages =
      this.#activeConversation === undefined
        ? this.#messages
        : [
            ...this.#messages,
            this.#activeConversation.userMessage,
            ...this.#activeConversation.imageMessages,
          ];
    return messages.map(cloneChatMessage);
  }

  reset(): void {
    this.#messages = this.#messages.filter(
      (message) => message.role === "system",
    );
  }

  undoLastTurn(): boolean {
    let index = this.#messages.length - 1;
    const assistant = this.#messages[index];
    if (
      index < 0 ||
      assistant?.role !== "assistant" ||
      generatedImagePart(assistant.content) !== undefined
    ) {
      return false;
    }
    index -= 1;
    if (index < 0 || this.#messages[index]?.role !== "user") {
      return false;
    }
    this.#messages = this.#messages.slice(0, index);
    return true;
  }

  reserveGeneratedImage(generationId: string, prompt: string): void {
    const duplicate = this.messages.some(
      (message) =>
        generatedImagePart(message.content)?.generationId === generationId,
    );
    if (duplicate) {
      throw new ChatError(
        "configuration",
        "Generated image identity already exists (" + generationId + ").",
      );
    }
    const message = generatedImageMessage(generationId, prompt);
    if (this.#activeConversation !== undefined) {
      this.#activeConversation.imageMessages.push(message);
    } else {
      this.#messages = [...this.#messages, message];
    }
  }

  resolveGeneratedImage(
    generationId: string,
    update: GeneratedImageTerminalUpdate,
  ): boolean {
    let found = false;
    const resolve = (message: ChatMessage): ChatMessage => {
      const part = generatedImagePart(message.content);
      if (part?.generationId !== generationId) return message;
      found = true;
      if (part.status !== "pending") return message;
      return updateGeneratedImageMessage(message, generationId, update);
    };
    this.#messages = this.#messages.map(resolve);
    if (this.#activeConversation !== undefined) {
      const images = this.#activeConversation.imageMessages;
      for (let index = 0; index < images.length; index += 1) {
        images[index] = resolve(images[index]!);
      }
    }
    return found;
  }

  async send(
    content: string,
    options: SendMessageOptions = {},
  ): Promise<ChatCompletion> {
    const normalized = content.trim();
    if (normalized.length === 0) {
      throw new ChatError("configuration", "Message must not be empty.");
    }
    if (this.#activeConversation !== undefined) {
      throw new ChatError(
        "configuration",
        "Chat session already has an active turn.",
      );
    }

    const userMessage: ChatMessage = { role: "user", content: normalized };
    const invocation = composeChatInvocation(
      this.#messages,
      normalized,
      options.invocation,
    );
    const generation = {
      ...this.#generation,
      ...options.generation,
    };
    const active: ActiveConversation = {
      userMessage,
      imageMessages: [],
    };
    this.#activeConversation = active;

    let completion: ChatCompletion;
    const wire: ChatWireMessage[] = [...invocation.messages];
    const tools = options.tools;
    if (
      tools &&
      (!Number.isSafeInteger(tools.maximumCalls) || tools.maximumCalls < 1)
    ) {
      this.#activeConversation = undefined;
      throw new ChatError(
        "configuration",
        "Tool call budget must be a positive integer.",
      );
    }
    let calls = 0;
    const usedIds = new Set<string>();
    try {
      for (;;) {
        options.signal?.throwIfAborted();
        if (tools) {
          validateBudget(
            options.invocation?.budget,
            JSON.stringify({ messages: wire, tools: tools.definitions }),
          );
        }
        let contentStreamed = false;
        let reasoningStreamed = false;
        completion = await this.#transport.complete(
          {
            model: this.#model,
            messages: wire,
            ...(options.imageAttachments?.length
              ? { imageAttachments: options.imageAttachments }
              : {}),
            ...(tools ? { tools: tools.definitions } : {}),
            options: generation,
            ...(options.signal === undefined
              ? {}
              : { signal: options.signal }),
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
        if (completion.message.role !== "assistant") {
          throw new ChatError(
            "invalid_response",
            "Transport returned a non-assistant completion.",
          );
        }
        if (tools) {
          if (!reasoningStreamed && completion.reasoning) {
            options.onDelta?.({
              type: "reasoning",
              text: completion.reasoning,
            });
          }
          if (!contentStreamed && completion.message.content) {
            options.onDelta?.({
              type: "content",
              text: completion.message.content,
            });
          }
        }
        if (!completion.toolCalls?.length) break;
        if (completion.finishReason === "length") {
          throw new ChatError(
            "invalid_response",
            "Truncated provider tool call; nothing executed.",
          );
        }
        if (!tools) {
          throw new ChatError(
            "invalid_response",
            "Provider requested tools that were not offered.",
          );
        }
        if (calls + completion.toolCalls.length > tools.maximumCalls) {
          throw new ChatError(
            "configuration",
            "Tool call budget exceeded (" + tools.maximumCalls + "). Change it under Global budgets.",
          );
        }
        for (const call of completion.toolCalls) {
          if (usedIds.has(call.id)) {
            throw new ChatError(
              "invalid_response",
              "Provider returned a duplicate tool call id (" + call.id + ").",
            );
          }
          if (!tools.definitions.some((def) => def.name === call.name)) {
            throw new ChatError(
              "invalid_response",
              'Provider requested unavailable tool "' + call.name + '".',
            );
          }
          usedIds.add(call.id);
        }
        wire.push({
          role: "assistant",
          content: completion.message.content,
          toolCalls: completion.toolCalls,
          ...(completion.reasoning
            ? { reasoning: completion.reasoning }
            : {}),
        });
        for (const call of completion.toolCalls) {
          options.signal?.throwIfAborted();
          const result = await tools.execute(call, options.signal);
          options.signal?.throwIfAborted();
          wire.push({
            role: "tool",
            toolCallId: call.id,
            content: result,
          });
          calls += 1;
        }
      }

      this.#messages = [
        ...this.#messages,
        active.userMessage,
        ...active.imageMessages,
        { ...completion.message },
      ];
      return completion;
    } catch (error) {
      if (active.imageMessages.length > 0) {
        this.#messages = [
          ...this.#messages,
          active.userMessage,
          ...active.imageMessages,
        ];
      }
      throw error;
    } finally {
      if (this.#activeConversation === active) {
        this.#activeConversation = undefined;
      }
    }
  }
}
