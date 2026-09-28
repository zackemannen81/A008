import { catalogBackedModelRegistry, defaultCatalogPath } from "../core/user-catalog.js";
import { defaultModelRegistry } from "../core/model-registry.js";
import type { ChatContent, ChatImageAttachment, ChatMessage } from "../core/types.js";
import { chatGeneration } from "../core/generation-controls.js";
import type { SessionParameters } from "../../packages/protocol/src/index.js";
import type {
  LocalMemoryRuntime,
  LocalMemorySession,
} from "../runtime/local-memory-runtime.js";

export interface PlatformTextHistoryMessage {
  readonly role: "user" | "assistant";
  readonly content: ChatContent;
}

export interface PlatformTextTurnResult {
  /** Newly appended assistant message, never inferred from a seed or stream. */
  readonly answer: ChatContent | undefined;
  readonly memoryStatus: "completed" | "failed" | "unknown";
}

/**
 * The registered model the project runtime will actually require.
 * Catalog changes are observed on each check.
 */
export function platformModelAvailable(
  env: NodeJS.ProcessEnv,
  model: string,
): boolean {
  try {
    catalogBackedModelRegistry(
      defaultModelRegistry,
      defaultCatalogPath(env),
    ).require(model);
    return true;
  } catch {
    return false;
  }
}

/**
 * One text-only session over committed history. The seed must already exclude
 * the run's new user message. No tools are prepared or supplied.
 */
export function openPlatformTextSession(input: {
  readonly runtime: LocalMemoryRuntime;
  readonly model: string;
  readonly conversationId: string;
  readonly history: readonly PlatformTextHistoryMessage[];
  readonly cwd?: string;
  readonly parameters?: SessionParameters;
}): LocalMemorySession {
  const session = input.runtime.openSession({
    model: input.model,
    ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
    conversationSeed: {
      conversationId: input.conversationId,
      messages: input.history.map(
        (message): ChatMessage => ({
          role: message.role,
          content: message.content,
        }),
      ),
    },
  });
  if (input.parameters !== undefined) session.configureParameters(input.parameters);
  return session;
}

/** Exactly one turn. A thrown post-output failure still reports a committed answer. */
export async function completePlatformTextTurn(
  session: LocalMemorySession,
  text: string,
  signal: AbortSignal,
  imageAttachments?: readonly ChatImageAttachment[],
): Promise<PlatformTextTurnResult> {
  const before = assistantCount(session.messages);
  try {
    const result = await session.turn(text, {
      signal,
      generation: chatGeneration(session.parameters),
      ...(imageAttachments?.length ? { imageAttachments } : {}),
    });
    const answer = newlyCommittedAnswer(before, session.messages);
    return {
      answer,
      memoryStatus:
        answer === undefined ? "unknown" : memoryStatusOf(result.postOutput.status),
    };
  } catch {
    const answer = newlyCommittedAnswer(before, session.messages);
    return {
      answer,
      memoryStatus: answer === undefined ? "unknown" : "failed",
    };
  }
}

function assistantCount(messages: readonly ChatMessage[]): number {
  return messages.filter((message) => message.role === "assistant").length;
}

function newlyCommittedAnswer(
  before: number,
  messages: readonly ChatMessage[],
): ChatContent | undefined {
  const assistants = messages.filter((message) => message.role === "assistant");
  if (assistants.length <= before) return undefined;
  return assistants[assistants.length - 1]?.content;
}

function memoryStatusOf(
  status: string,
): "completed" | "failed" | "unknown" {
  if (status === "completed") return "completed";
  if (
    status === "staging_failed" ||
    status === "commit_failed" ||
    status === "index_repair_required"
  ) {
    return "failed";
  }
  return "unknown";
}
