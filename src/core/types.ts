export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

export interface ChatToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}
export interface ChatToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: string;
}
/** Tool observations are invocation data, never committed conversation history. */
export type ChatWireMessage = ChatMessage | {
  readonly role: "assistant";
  readonly content: string;
  readonly toolCalls: readonly ChatToolCall[];
  readonly reasoning?: string;
} | {
  readonly role: "tool";
  readonly toolCallId: string;
  readonly content: string;
};
export interface ChatTools {
  readonly definitions: readonly ChatToolDefinition[];
  readonly maximumCalls: number;
  execute(call: ChatToolCall, signal?: AbortSignal): Promise<string>;
}

export interface ChatGenerationOptions {
  readonly temperature?: number | null;
  readonly topP?: number | null;
  readonly maxTokens?: number;
  readonly reasoningBudget?: number | null;
  readonly enableThinking?: boolean | null;
  readonly stream?: boolean;
  readonly reasoningEffort?: string | null;
  readonly seed?: number | null;
  readonly stop?: readonly string[] | null;
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatWireMessage[];
  readonly tools?: readonly ChatToolDefinition[];
  readonly options?: ChatGenerationOptions;
  readonly signal?: AbortSignal;
}

export type ChatDeltaType = "reasoning" | "content";

export interface ChatDelta {
  readonly type: ChatDeltaType;
  readonly text: string;
}

export interface ChatUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
}

export interface ChatExecutionEvidence {
  readonly id?: string;
  readonly replayed?: boolean;
  readonly diagnosticKind?: string;
}

export interface ChatCompletion {
  readonly message: ChatMessage;
  readonly reasoning?: string;
  readonly finishReason?: string | null;
  readonly usage?: ChatUsage;
  readonly toolCalls?: readonly ChatToolCall[];
  /** Execution-level identity/diagnostics; never semantic memory or chat content. */
  readonly execution?: ChatExecutionEvidence;
}

export interface ChatCallbacks {
  readonly onDelta?: (delta: ChatDelta) => void;
}

export interface ChatTransport {
  complete(
    request: ChatRequest,
    callbacks?: ChatCallbacks,
  ): Promise<ChatCompletion>;
}

/**
 * An input a model accepts. Text is universal but stated rather than implied,
 * so a profile never has an empty list.
 */
export type ModelModality = "text" | "image" | "video" | "audio";

/** Who executes a prepared chat call. Distinct from vendor `provider`. */
export type ExecutionProvider = "openai" | "nvidia" | "kie";

export interface ModelProfile {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  /**
   * A008-owned execution route. ACME receives this as `providerHint`.
   * Vendor identity stays in `provider` (Kimi is `moonshotai`, executed by NVIDIA).
   */
  readonly executionProvider?: ExecutionProvider;
  readonly defaults: ChatGenerationOptions;
  /**
   * What the model accepts as input.
   *
   * A008 does not yet send anything but text to a chat turn; `ChatMessage`
   * carries a `string` and ADR 0020 D6 kept it that way. This field exists so a
   * caller can *ask* before that changes, and so a client can show which models
   * could take an image rather than discovering it from a provider error.
   */
  readonly inputModalities: readonly ModelModality[];
  /**
   * Where this profile's numbers came from, as an ISO date. A profile without
   * it is unverified and should be treated as a guess.
   */
  readonly verifiedOn?: string;
}
