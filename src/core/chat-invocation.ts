import { ChatError } from "./errors.js";
import type { ChatMessage } from "./types.js";

export const DEFAULT_SYSTEM_MESSAGE = "You are a helpful AI assistant.";

export interface ChatMessageMeasurer {
  readonly unit: string;
  measure(serializedMessages: string): number;
}

export interface ChatInvocationBudget {
  readonly maximum: number;
  readonly label?: string;
  readonly measurer: ChatMessageMeasurer;
}

export interface ChatInvocationPlan {
  /** Explicit invocation configuration, combined with the session base. */
  readonly systemMessages?: readonly string[];
  /** Applicable data-handling rules; these do not replace the base fallback. */
  readonly contextSystemMessages?: readonly string[];
  readonly providerUserContent?: string;
  readonly historyMessageLimit?: number;
  readonly budget?: ChatInvocationBudget;
}

export interface ComposedChatInvocation {
  readonly messages: readonly ChatMessage[];
  readonly serialized: string;
  readonly measuredUnits: number | null;
  readonly measurementUnit: string | null;
}

function nonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ChatError("configuration", `${field} must not be empty.`);
  }
  return normalized;
}

function historyLimit(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ChatError(
      "configuration",
      "Chat invocation historyMessageLimit must be a non-negative safe integer.",
    );
  }
  return value;
}

export function validateBudget(
  budget: ChatInvocationBudget | undefined,
  serialized: string,
): {
  readonly measuredUnits: number | null;
  readonly measurementUnit: string | null;
} {
  if (budget === undefined) {
    return { measuredUnits: null, measurementUnit: null };
  }
  if (!Number.isSafeInteger(budget.maximum) || budget.maximum < 1) {
    throw new ChatError(
      "configuration",
      "Chat invocation budget maximum must be a positive safe integer.",
    );
  }
  const unit = nonEmpty(
    budget.measurer.unit,
    "Chat invocation measurement unit",
  );
  const measuredUnits = budget.measurer.measure(serialized);
  if (!Number.isSafeInteger(measuredUnits) || measuredUnits < 0) {
    throw new ChatError(
      "configuration",
      "Chat invocation measurer must return a non-negative safe integer.",
    );
  }
  if (measuredUnits > budget.maximum) {
    throw new ChatError(
      "configuration",
      `${budget.label ?? "Chat invocation"} exceeds the hard budget: ${measuredUnits}/${budget.maximum} ${unit}.`,
    );
  }
  return { measuredUnits, measurementUnit: unit };
}

export function serializeChatMessages(
  messages: readonly ChatMessage[],
): string {
  return JSON.stringify(
    messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  );
}

export function composeChatInvocation(
  committedMessages: readonly ChatMessage[],
  originalUserContent: string,
  plan: ChatInvocationPlan = {},
): ComposedChatInvocation {
  const original = nonEmpty(originalUserContent, "User message");
  const providerUserContent =
    plan.providerUserContent === undefined
      ? original
      : nonEmpty(plan.providerUserContent, "Provider-visible user content");
  const maximumHistory = historyLimit(plan.historyMessageLimit);
  const persistentSystemMessages = committedMessages
    .filter((message) => message.role === "system")
    .map((message) => nonEmpty(message.content, "Session system message"));
  const dialogue = committedMessages
    .filter((message) => message.role !== "system")
    .map((message) => ({ ...message }));
  const boundedDialogue =
    maximumHistory === undefined
      ? dialogue
      : maximumHistory === 0
        ? []
        : dialogue.slice(-maximumHistory);
  const configuredInstructions = [
    ...persistentSystemMessages,
    ...(plan.systemMessages ?? []).map((content, index) =>
      nonEmpty(content, `Chat invocation system message ${index + 1}`),
    ),
  ];
  const contextInstructions = (plan.contextSystemMessages ?? []).map(
    (content, index) =>
      nonEmpty(content, `Chat context instruction ${index + 1}`),
  );
  const systemInstruction = [
    ...(configuredInstructions.length
      ? configuredInstructions
      : [DEFAULT_SYSTEM_MESSAGE]),
    ...contextInstructions,
  ].join("\n\n");
  const messages: ChatMessage[] = [
    { role: "system", content: systemInstruction },
    ...boundedDialogue,
    { role: "user", content: providerUserContent },
  ];
  const serialized = serializeChatMessages(messages);
  return {
    messages,
    serialized,
    ...validateBudget(plan.budget, serialized),
  };
}

export class Utf8ByteChatMessageMeasurer implements ChatMessageMeasurer {
  readonly unit = "utf8-bytes";

  measure(serializedMessages: string): number {
    return Buffer.byteLength(serializedMessages, "utf8");
  }
}
