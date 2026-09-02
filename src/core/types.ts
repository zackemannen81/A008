export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

export interface ChatGenerationOptions {
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly reasoningBudget?: number;
  readonly enableThinking?: boolean;
  readonly stream?: boolean;
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
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

export interface ChatCompletion {
  readonly message: ChatMessage;
  readonly reasoning?: string;
  readonly finishReason?: string | null;
  readonly usage?: ChatUsage;
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

export interface ModelProfile {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly defaults: ChatGenerationOptions;
}
