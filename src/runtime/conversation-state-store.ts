import Database from "better-sqlite3";
import { existsSync } from "node:fs";
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

export interface ProjectConversationSummary {
  readonly conversationId: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly current: boolean;
}

function summaries(
  database: BetterSqliteDatabase,
  projectId: string,
): ProjectConversationSummary[] {
  const hasChats = database
    .prepare("SELECT 1 FROM sqlite_master WHERE name = 'A008_project_chats'")
    .get();
  const migrated = hasChats && database.prepare("SELECT 1 FROM A008_project_chat_selection WHERE namespace = ?").get(projectId);
  const rows = (
    migrated
      ? database
          .prepare(
            `SELECT c.conversation_id, c.messages_json, c.updated_at,
        c.conversation_id = a.conversation_id AS current
        FROM A008_project_chats c LEFT JOIN A008_project_chat_selection a USING(namespace)
        WHERE c.namespace = ? ORDER BY c.updated_at DESC, c.conversation_id`,
          )
          .all(projectId)
      : database
            .prepare(
              "SELECT 1 FROM sqlite_master WHERE name = 'A008_project_conversation'",
            )
            .get()
        ? database
            .prepare(
              "SELECT conversation_id, messages_json, updated_at, 1 AS current FROM A008_project_conversation WHERE namespace = ?",
            )
            .all(projectId)
        : []
  ) as {
    conversation_id: string;
    messages_json: string;
    updated_at: string;
    current: number;
  }[];
  return rows.map((row) => {
    const messages = JSON.parse(row.messages_json) as ChatMessage[];
    const first = messages.find((message) => message.role === "user");
    const text =
      typeof first?.content === "string"
        ? first.content
        : first?.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join(" ");
    return {
      conversationId: row.conversation_id,
      title: text?.replace(/\s+/gu, " ").trim().slice(0, 100) || "New chat",
      updatedAt: row.updated_at,
      current: row.current === 1,
    };
  });
}

/** Read summaries without starting a runtime or creating a store. */
export function readProjectConversations(
  filename: string,
  projectId: string,
): ProjectConversationSummary[] {
  if (filename === ":memory:" || !existsSync(filename)) return [];
  const database = new Database(filename, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    return summaries(database, projectId);
  } finally {
    database.close();
  }
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
      CREATE TABLE IF NOT EXISTS A008_project_chats (
        namespace TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        model TEXT NOT NULL,
        messages_json TEXT NOT NULL CHECK (json_valid(messages_json)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY(namespace, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS A008_project_chat_selection (
        namespace TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL
      );
    `);
    // The legacy row is a retained migration snapshot, never a second writer.
    this.#database.transaction(() => {
      const initialized = this.#database
        .prepare(
          "SELECT 1 FROM A008_project_chat_selection WHERE namespace = ?",
        )
        .get(projectId);
      if (initialized) return;
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO A008_project_chats
        SELECT namespace, conversation_id, model, messages_json, updated_at
        FROM A008_project_conversation WHERE namespace = ?`,
        )
        .run(projectId);
      this.#database
        .prepare(
          `INSERT OR IGNORE INTO A008_project_chat_selection
        SELECT namespace, conversation_id FROM A008_project_conversation WHERE namespace = ?`,
        )
        .run(projectId);
    })();
  }

  list(): ProjectConversationSummary[] {
    return summaries(this.#database, this.#projectId);
  }

  select(conversationId: string): void {
    if (
      !this.#database
        .prepare(
          "SELECT 1 FROM A008_project_chats WHERE namespace = ? AND conversation_id = ?",
        )
        .get(this.#projectId, conversationId)
    ) {
      throw new ChatError("configuration", "Unknown project conversation.");
    }
    this.#database
      .prepare(
        "INSERT INTO A008_project_chat_selection VALUES (?, ?) ON CONFLICT(namespace) DO UPDATE SET conversation_id = excluded.conversation_id",
      )
      .run(this.#projectId, conversationId);
  }

  load(): ProjectConversationState | undefined {
    const row = this.#database
      .prepare(
        `SELECT c.conversation_id, c.model, c.messages_json FROM A008_project_chats c
         JOIN A008_project_chat_selection a USING(namespace, conversation_id) WHERE c.namespace = ?`,
      )
      .get(this.#projectId) as ConversationRow | undefined;
    if (row === undefined) return undefined;
    const model = row.model.trim();
    if (!model) {
      throw new ChatError(
        "configuration",
        "Stored project conversation model is empty.",
      );
    }
    const conversationId = parseRuntimeId(row.conversation_id, "conversation");
    const parsed = parseMessages(row.messages_json);
    const state = { conversationId, model, messages: parsed.messages };
    if (parsed.changed) this.save(state);
    return state;
  }

  save(state: ProjectConversationState, replacedConversationId?: string): void {
    const messages = state.messages.map(cloneChatMessage);
    if (messages.some((message) => message.role === "system")) {
      throw new ChatError(
        "configuration",
        "Project conversation persistence excludes system messages.",
      );
    }
    this.#database.transaction(() => {
      this.#database
        .prepare(
          `
        INSERT INTO A008_project_chats
          (namespace, conversation_id, model, messages_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(namespace, conversation_id) DO UPDATE SET
          conversation_id = excluded.conversation_id,
          model = excluded.model,
          messages_json = excluded.messages_json,
          updated_at = excluded.updated_at
      `,
        )
        .run(
          this.#projectId,
          state.conversationId,
          state.model,
          JSON.stringify(messages),
          new Date().toISOString(),
        );
      this.select(state.conversationId);
      if (
        replacedConversationId &&
        replacedConversationId !== state.conversationId
      ) {
        this.#database
          .prepare(
            "DELETE FROM A008_project_chats WHERE namespace = ? AND conversation_id = ?",
          )
          .run(this.#projectId, replacedConversationId);
      }
    })();
  }

  close(): void {
    this.#database.close();
  }
}
