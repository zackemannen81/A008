import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { chatContentSchema } from "../../packages/protocol/src/index.js";
import { ChatError } from "../core/errors.js";
import { cloneChatMessage } from "../core/chat-content.js";
import type { ChatContent, ChatMessage } from "../core/types.js";
import { parseRuntimeId } from "../identity/runtime-id.js";
import type { ConversationId, ProjectId } from "../identity/types.js";

interface ConversationRow {
  readonly conversation_id: string;
  readonly model: string;
  readonly messages_json: string;
}

export interface ProjectConversationState {
  readonly conversationId: ConversationId;
  readonly model: string;
  readonly messages: readonly ChatMessage[];
}

const STALE_PENDING_ERROR =
  "Image generation did not complete before the previous workspace session ended.";

function normalizeContent(content: ChatContent): {
  content: ChatContent;
  changed: boolean;
} {
  if (typeof content === "string") return { content, changed: false };
  let changed = false;
  const normalized = content.map((part) => {
    if (part.type !== "generated_image" || part.status !== "pending") return part;
    changed = true;
    return {
      ...part,
      status: "cancelled" as const,
      error: STALE_PENDING_ERROR,
    };
  });
  return { content: normalized, changed };
}

function parseMessages(value: string): {
  messages: ChatMessage[];
  changed: boolean;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new ChatError("configuration", "Stored project conversation is not valid JSON.", {
      cause: error,
    });
  }
  if (!Array.isArray(parsed)) {
    throw new ChatError("configuration", "Stored project conversation messages must be an array.");
  }
  let changed = false;
  const messages = parsed.map((candidate, index): ChatMessage => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("role" in candidate) ||
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      !("content" in candidate)
    ) {
      throw new ChatError(
        "configuration",
        `Stored project conversation message ${index} is invalid.`,
      );
    }
    const content = chatContentSchema.parse(candidate.content);
    const normalized = normalizeContent(content);
    changed ||= normalized.changed;
    return { role: candidate.role, content: normalized.content };
  });
  return { messages, changed };
}

export class ProjectConversationStateStore {
  readonly #database: BetterSqliteDatabase;
  readonly #projectId: ProjectId;

  constructor(filename: string, projectId: ProjectId) {
    this.#projectId = projectId;
    this.#database = new Database(filename);
    this.#database.pragma("busy_timeout = 5000");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS A008_project_conversation (
        namespace TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        model TEXT NOT NULL,
        messages_json TEXT NOT NULL CHECK (json_valid(messages_json)),
        updated_at TEXT NOT NULL
      );
    `);
  }

  load(): ProjectConversationState | undefined {
    const row = this.#database
      .prepare(
        "SELECT conversation_id, model, messages_json FROM A008_project_conversation WHERE namespace = ?",
      )
      .get(this.#projectId) as ConversationRow | undefined;
    if (row === undefined) return undefined;
    const model = row.model.trim();
    if (!model) {
      throw new ChatError("configuration", "Stored project conversation model is empty.");
    }
    const conversationId = parseRuntimeId(row.conversation_id, "conversation");
    const parsed = parseMessages(row.messages_json);
    const state = { conversationId, model, messages: parsed.messages };
    if (parsed.changed) this.save(state);
    return state;
  }

  save(state: ProjectConversationState): void {
    const messages = state.messages.map(cloneChatMessage);
    if (messages.some((message) => message.role === "system")) {
      throw new ChatError(
        "configuration",
        "Project conversation persistence excludes system messages.",
      );
    }
    this.#database
      .prepare(`
        INSERT INTO A008_project_conversation
          (namespace, conversation_id, model, messages_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(namespace) DO UPDATE SET
          conversation_id = excluded.conversation_id,
          model = excluded.model,
          messages_json = excluded.messages_json,
          updated_at = excluded.updated_at
      `)
      .run(
        this.#projectId,
        state.conversationId,
        state.model,
        JSON.stringify(messages),
        new Date().toISOString(),
      );
  }

  close(): void {
    this.#database.close();
  }
}
