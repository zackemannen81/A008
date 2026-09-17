import { ChatSession, type SendMessageOptions } from "../core/chat-session.js";
import type { ChatCompletion, ChatGenerationOptions } from "../core/types.js";
import type { ChatInvocationBudget } from "../core/chat-invocation.js";
import { ChatError } from "../core/errors.js";
import { parseRuntimeId } from "../identity/runtime-id.js";
import type {
  AgentId,
  ConversationId,
  ProjectId,
  RuntimeTaskId,
} from "../identity/types.js";
import { MemoryError } from "../memory/errors.js";
import type {
  HybridMemoryReadResult,
  MemoryReadRequest,
} from "../memory/retrieval-types.js";
import {
  DeterministicMemoryPromptComposer,
  type MemoryPromptComposer,
} from "./memory-prompt-composer.js";

export interface MemoryReadPort {
  read(
    request: MemoryReadRequest,
    options?: { readonly signal?: AbortSignal },
  ): Promise<HybridMemoryReadResult>;
}

export interface MemoryAwareSessionContext {
  readonly projectId: ProjectId;
  readonly conversationId: ConversationId;
  readonly agentId: AgentId;
}

export interface MemoryAwareChatSessionOptions {
  readonly chat: ChatSession;
  readonly memoryReader: MemoryReadPort;
  readonly context: MemoryAwareSessionContext;
  readonly invocationBudget: ChatInvocationBudget;
  readonly promptComposer?: MemoryPromptComposer;
  readonly recentMessageLimit?: number;
  readonly systemInstructions?: string;
}

export interface MemoryAwareTurnInput {
  readonly taskId: RuntimeTaskId;
  readonly message: string;
  readonly applicabilityScopes: readonly string[];
  readonly requiredKnowledgeIds?: readonly string[];
}

export interface MemoryAwareTurnOptions {
  readonly generation?: ChatGenerationOptions;
  readonly imageAttachments?: SendMessageOptions["imageAttachments"];
  readonly signal?: AbortSignal;
  readonly onDelta?: SendMessageOptions["onDelta"];
  readonly tools?: SendMessageOptions["tools"];
}

export interface MemoryAwareTurnResult {
  readonly completion: ChatCompletion;
  readonly memory: HybridMemoryReadResult;
}

function boundedRecentMessageLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ChatError(
      "configuration",
      "Memory-aware recentMessageLimit must be a non-negative safe integer.",
    );
  }
  return value;
}

function validatedInvocationBudget(
  budget: ChatInvocationBudget,
): ChatInvocationBudget {
  if (!Number.isSafeInteger(budget.maximum) || budget.maximum < 1) {
    throw new ChatError(
      "configuration",
      "Memory-aware invocation budget must be a positive safe integer.",
    );
  }
  if (budget.measurer.unit.trim().length === 0) {
    throw new ChatError(
      "configuration",
      "Memory-aware invocation measurement unit must not be empty.",
    );
  }
  return { ...budget };
}

function nonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ChatError("configuration", `${field} must not be empty.`);
  }
  return normalized;
}

function copiedStrings(values: readonly string[], field: string): string[] {
  return values.map((value, index) => nonEmpty(value, `${field} ${index + 1}`));
}

export class MemoryAwareChatSession {
  readonly #chat: ChatSession;
  readonly #memoryReader: MemoryReadPort;
  readonly #context: MemoryAwareSessionContext;
  readonly #invocationBudget: ChatInvocationBudget;
  readonly #promptComposer: MemoryPromptComposer;
  readonly #recentMessageLimit: number;
  readonly #systemInstructions: string;
  #active = false;

  constructor(options: MemoryAwareChatSessionOptions) {
    this.#chat = options.chat;
    this.#memoryReader = options.memoryReader;
    this.#context = {
      projectId: parseRuntimeId(options.context.projectId, "project"),
      conversationId: parseRuntimeId(
        options.context.conversationId,
        "conversation",
      ),
      agentId: parseRuntimeId(options.context.agentId, "agent"),
    };
    this.#invocationBudget = validatedInvocationBudget(
      options.invocationBudget,
    );
    this.#promptComposer =
      options.promptComposer ?? new DeterministicMemoryPromptComposer();
    this.#recentMessageLimit = boundedRecentMessageLimit(
      options.recentMessageLimit ?? 2,
    );
    this.#systemInstructions = options.systemInstructions?.trim() ?? "";
  }

  get model(): string {
    return this.#chat.model;
  }

  get messages() {
    return this.#chat.messages;
  }

  reset(): void {
    if (this.#active) {
      throw new ChatError(
        "configuration",
        "Cannot reset a memory-aware session during an active turn.",
      );
    }
    this.#chat.reset();
  }

  undoLastTurn(): boolean {
    if (this.#active) {
      throw new ChatError(
        "configuration",
        "Cannot undo a memory-aware session during an active turn.",
      );
    }
    return this.#chat.undoLastTurn();
  }

  async send(
    input: MemoryAwareTurnInput,
    options: MemoryAwareTurnOptions = {},
  ): Promise<MemoryAwareTurnResult> {
    if (this.#active) {
      throw new ChatError(
        "configuration",
        "Memory-aware session already has an active turn.",
      );
    }
    this.#active = true;
    try {
      const taskId = parseRuntimeId(input.taskId, "task");
      const message = nonEmpty(input.message, "Message");
      const applicabilityScopes = copiedStrings(
        input.applicabilityScopes,
        "Applicability scope",
      );
      const requiredKnowledgeIds = copiedStrings(
        input.requiredKnowledgeIds ?? [],
        "Required knowledge ID",
      );
      const recentTurns = (
        this.#recentMessageLimit === 0
          ? []
          : this.#chat.messages
              .filter(
                (
                  entry,
                ): entry is {
                  readonly role: "user" | "assistant";
                  readonly content: string;
                } => entry.role === "user" || entry.role === "assistant",
              )
              .slice(-this.#recentMessageLimit)
      ).map((entry) => ({ ...entry }));
      const request: MemoryReadRequest = {
        ...this.#context,
        taskId,
        message,
        recentTurns,
        applicabilityScopes,
        requiredKnowledgeIds,
      };
      const memory = await this.#memoryReader.read(
        request,
        options.signal === undefined ? {} : { signal: options.signal },
      );
      if (options.signal?.aborted)
        throw new ChatError("cancelled", "Memory-aware turn was cancelled.");
      this.#validateMemoryResult(memory, request);
      const prompt = this.#promptComposer.compose(memory.projection, message);
      const sendOptions: SendMessageOptions = {
        invocation: {
          systemMessages: [
            ...(this.#systemInstructions ? [this.#systemInstructions] : []),
          ],
          contextSystemMessages: [prompt.systemInstruction],
          providerUserContent: prompt.userEnvelope,
          historyMessageLimit: this.#recentMessageLimit,
          budget: this.#invocationBudget,
        },
        ...(options.generation === undefined
          ? {}
          : { generation: options.generation }),
        ...(options.imageAttachments?.length
          ? { imageAttachments: options.imageAttachments }
          : {}),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(options.onDelta === undefined ? {} : { onDelta: options.onDelta }),
        ...(options.tools === undefined ? {} : { tools: options.tools }),
      };
      const completion = await this.#chat.send(message, sendOptions);
      return { completion, memory };
    } finally {
      this.#active = false;
    }
  }

  #validateMemoryResult(
    result: HybridMemoryReadResult,
    request: MemoryReadRequest,
  ): void {
    if (
      result.plan.projectId !== request.projectId ||
      result.plan.conversationId !== request.conversationId ||
      result.plan.taskId !== request.taskId ||
      result.plan.agentId !== request.agentId ||
      result.projection.projection.taskId !== request.taskId
    ) {
      throw new MemoryError(
        "policy",
        "memory reader returned a result for another verified runtime context",
      );
    }
  }
}
