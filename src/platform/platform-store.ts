import { createHash, randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { chatContentSchema } from "../../packages/protocol/src/index.js";
import type { ChatContent } from "../core/types.js";
import {
  parseRuntimeId,
  RuntimeIdentityFactory,
} from "../identity/runtime-id.js";
import {
  PLATFORM_SQLITE_SCHEMA,
  PLATFORM_SQLITE_SCHEMA_VERSION,
} from "./sqlite-schema.js";
import type {
  AcceptPlatformRun,
  AcceptedPlatformRun,
  CancelPlatformRun,
  ClaimedPlatformRun,
  ClaimPlatformRun,
  CommitPlatformAnswer,
  CreatePlatformConversation,
  FailPlatformRun,
  LeaseWrite,
  ListPlatformRuns,
  PlatformConversation,
  PlatformEffectStatus,
  PlatformEvent,
  PlatformEventPage,
  PlatformEventType,
  PlatformLease,
  PlatformMemoryStatus,
  PlatformMessage,
  PlatformRun,
  PlatformRunStatus,
  PlatformScope,
  RecordMemoryOutcome,
  RenewPlatformLease,
} from "./types.js";

const TERMINAL_RUN_STATUSES = new Set<PlatformRunStatus>([
  "succeeded",
  "failed",
  "cancelled",
]);
const MAX_CONVERSATION_MESSAGES = 10_000;

interface ConversationRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly project_id: string;
  readonly workspace_id: string;
  readonly title: string;
  readonly created_at: number;
  readonly updated_at: number;
  readonly revision: number;
}

interface MessageRow {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content_json: string;
  readonly created_at: number;
  readonly run_id: string | null;
}

interface RunRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly project_id: string;
  readonly conversation_id: string;
  readonly workspace_id: string;
  readonly principal_id: string;
  readonly command_id: string;
  readonly model: string;
  readonly status: PlatformRunStatus;
  readonly revision: number;
  readonly created_at: number;
  readonly updated_at: number;
  readonly lease_generation: number;
  readonly lease_owner_token: string | null;
  readonly lease_expires_at: number | null;
  readonly dispatch_recorded: number;
  readonly effect_status: PlatformEffectStatus;
  readonly answer_status: PlatformRun["answerStatus"];
  readonly memory_status: PlatformMemoryStatus;
  readonly error_code: string | null;
  readonly error_message: string | null;
}

interface ReceiptRow {
  readonly payload_digest: string;
  readonly run_id: string;
}

interface EventRow {
  readonly cursor: number;
  readonly tenant_id: string;
  readonly project_id: string;
  readonly conversation_id: string;
  readonly run_id: string | null;
  readonly type: PlatformEventType;
  readonly resource_revision: number;
  readonly created_at: number;
}

export class PlatformStoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PlatformStoreError";
    this.code = code;
  }
}

export interface PlatformStoreOptions {
  readonly filename: string;
  readonly clock?: () => number;
  readonly identityFactory?: RuntimeIdentityFactory;
  readonly idFactory?: () => string;
  readonly database?: BetterSqliteDatabase;
}

/**
 * The first durable platform owner. It stores only conversation/run state,
 * receipts and outbox notifications; it never opens or writes knowledge tables.
 */
export class PlatformStore {
  readonly filename: string;
  readonly schemaVersion = PLATFORM_SQLITE_SCHEMA_VERSION;
  readonly #database: BetterSqliteDatabase;
  readonly #ownsDatabase: boolean;
  readonly #clock: () => number;
  readonly #identityFactory: RuntimeIdentityFactory;
  readonly #idFactory: () => string;
  #closed = false;

  constructor(options: PlatformStoreOptions) {
    this.filename = options.filename;
    this.#database = options.database ?? new Database(options.filename);
    this.#ownsDatabase = options.database === undefined;
    this.#clock = options.clock ?? Date.now;
    this.#identityFactory =
      options.identityFactory ?? new RuntimeIdentityFactory();
    this.#idFactory = options.idFactory ?? randomUUID;
    try {
      this.#database.pragma("foreign_keys = ON");
      this.#database.pragma("busy_timeout = 5000");
      this.#initializeSchema();
    } catch (error) {
      if (this.#ownsDatabase) this.#database.close();
      throw error;
    }
  }

  createConversation(
    scope: PlatformScope,
    input: CreatePlatformConversation,
  ): PlatformConversation {
    this.#requireOpen();
    this.#validateScope(scope);
    const title = this.#bounded(input.title, "title", 1, 200);
    const workspaceId = this.#bounded(input.workspaceId ?? "legacy-unbound", "workspaceId", 1, 256);
    const id = parseRuntimeId(
      input.id ?? this.#identityFactory.create("conversation"),
      "conversation",
    );
    const now = this.#now();
    this.#immediate(() => {
      this.#database
        .prepare(
          `INSERT INTO A008_platform_conversations
           (id, tenant_id, project_id, workspace_id, title, created_at, updated_at, revision)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        )
        .run(id, scope.tenantId, scope.projectId, workspaceId, title, now, now);
      this.#appendEvent(scope, id, null, "conversation.created", 0, now);
    });
    return this.#conversation(scope, id);
  }

  listConversations(scope: PlatformScope): readonly PlatformConversation[] {
    this.#requireOpen();
    this.#validateScope(scope);
    const rows = this.#database
      .prepare(
        `SELECT id FROM A008_platform_conversations
         WHERE tenant_id = ? AND project_id = ? ORDER BY updated_at DESC, id`,
      )
      .all(scope.tenantId, scope.projectId) as { readonly id: string }[];
    return rows.map((row) => this.#conversation(scope, row.id));
  }

  getConversation(
    scope: PlatformScope,
    conversationId: string,
  ): PlatformConversation {
    this.#requireOpen();
    this.#validateScope(scope);
    return this.#conversation(scope, conversationId);
  }

  /**
   * Read-only command receipt check. It uses the same canonical digest as
   * `acceptRun` and never inserts a conversation, message, run, or event.
   */
  lookupRunReceipt(
    scope: PlatformScope,
    input: AcceptPlatformRun,
  ): AcceptedPlatformRun | undefined {
    this.#requireOpen();
    this.#validateScope(scope);
    const canonical = this.#canonicalRunCreate(input);
    return this.#matchingReceipt(
      scope,
      canonical.commandId,
      canonical.payloadDigest,
    );
  }

  acceptRun(
    scope: PlatformScope,
    input: AcceptPlatformRun,
  ): AcceptedPlatformRun {
    this.#requireOpen();
    this.#validateScope(scope);
    const canonical = this.#canonicalRunCreate(input);
    const conversationId = canonical.conversationId;
    const commandId = canonical.commandId;
    const model = canonical.model;
    const text = canonical.text;
    const payloadDigest = canonical.payloadDigest;
    const runId = this.#opaqueId(input.runId, "runId", "run");
    const messageId = this.#opaqueId(input.messageId, "messageId", "message");
    const now = this.#now();
    let accepted: AcceptedPlatformRun | undefined;

    this.#immediate(() => {
      const replay = this.#matchingReceipt(scope, commandId, payloadDigest);
      if (replay !== undefined) {
        accepted = replay;
        return;
      }

      const conversation = this.#conversationRow(scope, conversationId);
      if (conversation.revision !== canonical.expectedRevision) {
        throw new PlatformStoreError(
          "REVISION_CONFLICT",
          "Conversation revision does not match.",
        );
      }
      const active = this.#database
        .prepare(
          `SELECT id FROM A008_platform_runs
           WHERE tenant_id = ? AND project_id = ? AND conversation_id = ?
             AND status NOT IN ('succeeded', 'failed', 'cancelled') LIMIT 1`,
        )
        .get(scope.tenantId, scope.projectId, conversationId) as
        { readonly id: string } | undefined;
      if (active !== undefined) {
        throw new PlatformStoreError(
          "CONVERSATION_BUSY",
          "Conversation already has a nonterminal writing run.",
        );
      }
      const messageCount = this.#database
        .prepare(
          "SELECT count(*) AS count FROM A008_platform_messages WHERE conversation_id = ?",
        )
        .get(conversationId) as { readonly count: number };
      // Reserve one slot for the accepted user message and one for its only answer.
      if (messageCount.count > MAX_CONVERSATION_MESSAGES - 2) {
        throw new PlatformStoreError(
          "CAPACITY_EXCEEDED",
          "Conversation has no bounded snapshot capacity for another run and answer.",
        );
      }

      const nextConversationRevision = conversation.revision + 1;
      const memoryStatus: PlatformMemoryStatus =
        input.memoryRequested === true ? "pending" : "not_requested";
      this.#database
        .prepare(
          `INSERT INTO A008_platform_messages
           (id, conversation_id, role, content_json, created_at, run_id)
           VALUES (?, ?, 'user', ?, ?, ?)`,
        )
        .run(messageId, conversationId, JSON.stringify(text), now, runId);
      this.#database
        .prepare(
          `UPDATE A008_platform_conversations SET revision = ?, updated_at = ? WHERE id = ?`,
        )
        .run(nextConversationRevision, now, conversationId);
      this.#database
        .prepare(
          `INSERT INTO A008_platform_runs
           (id, tenant_id, project_id, conversation_id, workspace_id, principal_id, command_id, model,
            status, revision, created_at, updated_at, lease_generation, dispatch_recorded,
            effect_status, answer_status, memory_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, 0, 0, 'none', 'pending', ?)`,
        )
        .run(
          runId,
          scope.tenantId,
          scope.projectId,
          conversationId,
          conversation.workspace_id,
          scope.principalId,
          commandId,
          model,
          now,
          now,
          memoryStatus,
        );
      this.#database
        .prepare(
          `INSERT INTO A008_platform_command_receipts
           (tenant_id, principal_id, command_id, operation, payload_digest, run_id, created_at)
           VALUES (?, ?, ?, 'run.create', ?, ?, ?)`,
        )
        .run(
          scope.tenantId,
          scope.principalId,
          commandId,
          payloadDigest,
          runId,
          now,
        );
      this.#appendEvent(scope, conversationId, runId, "run.queued", 0, now);
      this.#appendEvent(
        scope,
        conversationId,
        runId,
        "conversation.updated",
        nextConversationRevision,
        now,
      );
      accepted = { run: this.#run(scope, runId), replayed: false };
    });
    return accepted!;
  }

  getRun(scope: PlatformScope, runId: string): PlatformRun {
    this.#requireOpen();
    this.#validateScope(scope);
    return this.#run(scope, runId);
  }

  /** Scoped recovery/queue inspection. It deliberately exposes no scheduler. */
  listRuns(
    scope: PlatformScope,
    input: ListPlatformRuns = {},
  ): readonly PlatformRun[] {
    this.#requireOpen();
    this.#validateScope(scope);
    const statuses = input.statuses;
    if (statuses !== undefined && statuses.length === 0) return [];
    if (
      statuses !== undefined &&
      statuses.some((status) => !isRunStatus(status))
    ) {
      throw new PlatformStoreError(
        "INVALID_REQUEST",
        "Run status filter contains an unsupported status.",
      );
    }
    const filter =
      statuses === undefined
        ? ""
        : ` AND status IN (${statuses.map(() => "?").join(", ")})`;
    const rows = this.#database
      .prepare(
        `SELECT * FROM A008_platform_runs WHERE tenant_id = ? AND project_id = ?${filter}
         ORDER BY created_at, id`,
      )
      .all(scope.tenantId, scope.projectId, ...(statuses ?? [])) as RunRow[];
    return rows.map(runFromRow);
  }

  claimRun(scope: PlatformScope, input: ClaimPlatformRun): ClaimedPlatformRun {
    this.#requireOpen();
    this.#validateScope(scope);
    const ownerToken = this.#bounded(input.ownerToken, "ownerToken", 1, 256);
    this.#positiveInteger(input.leaseDurationMs, "leaseDurationMs");
    const now = this.#now();
    let result: ClaimedPlatformRun | undefined;
    this.#immediate(() => {
      const run = this.#runRow(scope, input.runId);
      if (run.status !== "queued") {
        throw new PlatformStoreError(
          "LEASE_LOST",
          "Only a queued run can be claimed.",
        );
      }
      const generation = run.lease_generation + 1;
      const expiresAt = now + input.leaseDurationMs;
      const revision = run.revision + 1;
      this.#database
        .prepare(
          `UPDATE A008_platform_runs
           SET status = 'running', revision = ?, updated_at = ?, lease_generation = ?,
               lease_owner_token = ?, lease_expires_at = ? WHERE id = ?`,
        )
        .run(revision, now, generation, ownerToken, expiresAt, run.id);
      this.#appendEvent(
        scope,
        run.conversation_id,
        run.id,
        "run.updated",
        revision,
        now,
      );
      result = {
        run: this.#run(scope, run.id),
        lease: { runId: run.id, ownerToken, generation, expiresAt },
      };
    });
    return result!;
  }

  renewLease(scope: PlatformScope, input: RenewPlatformLease): PlatformLease {
    this.#requireOpen();
    this.#validateScope(scope);
    this.#positiveInteger(input.leaseDurationMs, "leaseDurationMs");
    const now = this.#now();
    let lease: PlatformLease | undefined;
    this.#immediate(() => {
      const run = this.#currentLease(scope, input, now);
      const expiresAt = now + input.leaseDurationMs;
      this.#database
        .prepare(
          "UPDATE A008_platform_runs SET lease_expires_at = ? WHERE id = ?",
        )
        .run(expiresAt, run.id);
      lease = {
        runId: run.id,
        ownerToken: input.ownerToken,
        generation: input.generation,
        expiresAt,
      };
    });
    return lease!;
  }

  recordDispatch(scope: PlatformScope, input: LeaseWrite): PlatformRun {
    return this.#leaseTransition(scope, input, "running", (run, now) => {
      const revision = run.revision + 1;
      this.#database
        .prepare(
          `UPDATE A008_platform_runs SET dispatch_recorded = 1, effect_status = 'unknown',
           revision = ?, updated_at = ? WHERE id = ?`,
        )
        .run(revision, now, run.id);
      this.#appendEvent(
        scope,
        run.conversation_id,
        run.id,
        "run.updated",
        revision,
        now,
      );
    });
  }

  commitAnswer(scope: PlatformScope, input: CommitPlatformAnswer): PlatformRun {
    this.#requireOpen();
    this.#validateScope(scope);
    const content = chatContentSchema.parse(input.content) as ChatContent;
    const messageId = this.#opaqueId(input.messageId, "messageId", "message");
    const now = this.#now();
    let result: PlatformRun | undefined;
    this.#immediate(() => {
      const run = this.#currentLease(scope, input, now);
      this.#requireRevision(run, input.expectedRevision);
      if (run.status !== "running" && run.status !== "cancel_requested") {
        throw new PlatformStoreError(
          "REVISION_CONFLICT",
          "Only a running or cancellation-requested run can commit an answer.",
        );
      }
      const conversation = this.#conversationRow(scope, run.conversation_id);
      const conversationRevision = conversation.revision + 1;
      const revision = run.revision + 1;
      this.#database
        .prepare(
          `INSERT INTO A008_platform_messages
           (id, conversation_id, role, content_json, created_at, run_id)
           VALUES (?, ?, 'assistant', ?, ?, ?)`,
        )
        .run(
          messageId,
          run.conversation_id,
          JSON.stringify(content),
          now,
          run.id,
        );
      this.#database
        .prepare(
          "UPDATE A008_platform_conversations SET revision = ?, updated_at = ? WHERE id = ?",
        )
        .run(conversationRevision, now, run.conversation_id);
      this.#database
        .prepare(
          `UPDATE A008_platform_runs
           SET status = 'succeeded', revision = ?, updated_at = ?, lease_owner_token = NULL,
               lease_expires_at = NULL, effect_status = 'known', answer_status = 'completed'
           WHERE id = ?`,
        )
        .run(revision, now, run.id);
      this.#appendEvent(
        scope,
        run.conversation_id,
        run.id,
        "run.updated",
        revision,
        now,
      );
      this.#appendEvent(
        scope,
        run.conversation_id,
        run.id,
        "conversation.updated",
        conversationRevision,
        now,
      );
      result = this.#run(scope, run.id);
    });
    return result!;
  }

  failRun(scope: PlatformScope, input: FailPlatformRun): PlatformRun {
    this.#requireOpen();
    this.#validateScope(scope);
    const code = this.#bounded(input.error.code, "error.code", 1, 128);
    const message = this.#bounded(
      input.error.message,
      "error.message",
      1,
      1024,
    );
    return this.#leaseTransition(scope, input, "running", (run, now) => {
      if (run.effect_status === "unknown") {
        throw new PlatformStoreError(
          "NEEDS_RECONCILIATION",
          "An unknown dispatched effect cannot be failed without reconciliation.",
        );
      }
      const revision = run.revision + 1;
      this.#database
        .prepare(
          `UPDATE A008_platform_runs SET status = 'failed', revision = ?, updated_at = ?,
             lease_owner_token = NULL, lease_expires_at = NULL, answer_status = 'failed',
             error_code = ?, error_message = ? WHERE id = ?`,
        )
        .run(revision, now, code, message, run.id);
      this.#appendEvent(
        scope,
        run.conversation_id,
        run.id,
        "run.updated",
        revision,
        now,
      );
    });
  }

  requestCancel(scope: PlatformScope, input: CancelPlatformRun): PlatformRun {
    this.#requireOpen();
    this.#validateScope(scope);
    this.#safeInteger(input.expectedRevision, "expectedRevision");
    const now = this.#now();
    let result: PlatformRun | undefined;
    this.#immediate(() => {
      const run = this.#runRow(scope, input.runId);
      if (TERMINAL_RUN_STATUSES.has(run.status)) {
        result = this.#run(scope, run.id);
        return;
      }
      if (run.status === "needs_reconciliation") {
        throw new PlatformStoreError(
          "NEEDS_RECONCILIATION",
          "A run with an unknown effect cannot be cancelled without reconciliation.",
        );
      }
      this.#requireRevision(run, input.expectedRevision);
      const status: PlatformRunStatus =
        run.status === "queued" ? "cancelled" : "cancel_requested";
      const revision = run.revision + 1;
      this.#database
        .prepare(
          `UPDATE A008_platform_runs SET status = ?, revision = ?, updated_at = ?,
           lease_owner_token = CASE WHEN ? = 'cancelled' THEN NULL ELSE lease_owner_token END,
           lease_expires_at = CASE WHEN ? = 'cancelled' THEN NULL ELSE lease_expires_at END
           WHERE id = ?`,
        )
        .run(status, revision, now, status, status, run.id);
      this.#appendEvent(
        scope,
        run.conversation_id,
        run.id,
        "run.updated",
        revision,
        now,
      );
      result = this.#run(scope, run.id);
    });
    return result!;
  }

  confirmCancellation(scope: PlatformScope, input: LeaseWrite): PlatformRun {
    return this.#leaseTransition(
      scope,
      input,
      "cancel_requested",
      (run, now) => {
        if (run.effect_status === "unknown") {
          throw new PlatformStoreError(
            "NEEDS_RECONCILIATION",
            "An unknown dispatched effect cannot be confirmed as cancelled.",
          );
        }
        const revision = run.revision + 1;
        this.#database
          .prepare(
            `UPDATE A008_platform_runs SET status = 'cancelled', revision = ?, updated_at = ?,
             lease_owner_token = NULL, lease_expires_at = NULL WHERE id = ?`,
          )
          .run(revision, now, run.id);
        this.#appendEvent(
          scope,
          run.conversation_id,
          run.id,
          "run.updated",
          revision,
          now,
        );
      },
    );
  }

  recordMemoryOutcome(
    scope: PlatformScope,
    input: RecordMemoryOutcome,
  ): PlatformRun {
    this.#requireOpen();
    this.#validateScope(scope);
    const allowed = new Set<PlatformMemoryStatus>([
      "completed",
      "failed",
      "unknown",
    ]);
    if (!allowed.has(input.status)) {
      throw new PlatformStoreError(
        "INVALID_REQUEST",
        "Memory outcome must be completed, failed, or unknown.",
      );
    }
    const now = this.#now();
    let result: PlatformRun | undefined;
    this.#immediate(() => {
      const run = this.#runRow(scope, input.runId);
      this.#requireRevision(run, input.expectedRevision);
      if (run.answer_status !== "completed") {
        throw new PlatformStoreError(
          "REVISION_CONFLICT",
          "Memory outcome is recorded only after the answer is committed.",
        );
      }
      const revision = run.revision + 1;
      this.#database
        .prepare(
          "UPDATE A008_platform_runs SET memory_status = ?, revision = ?, updated_at = ? WHERE id = ?",
        )
        .run(input.status, revision, now, run.id);
      this.#appendEvent(
        scope,
        run.conversation_id,
        run.id,
        "run.updated",
        revision,
        now,
      );
      result = this.#run(scope, run.id);
    });
    return result!;
  }

  /** Requeues only verified pre-dispatch work; dispatched uncertainty stays blocked. */
  recoverExpiredLeases(scope: PlatformScope): readonly PlatformRun[] {
    this.#requireOpen();
    this.#validateScope(scope);
    const now = this.#now();
    const recovered: PlatformRun[] = [];
    this.#immediate(() => {
      const rows = this.#database
        .prepare(
          `SELECT * FROM A008_platform_runs
           WHERE tenant_id = ? AND project_id = ? AND status IN ('running', 'cancel_requested')
             AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?`,
        )
        .all(scope.tenantId, scope.projectId, now) as RunRow[];
      for (const run of rows) {
        const status: PlatformRunStatus =
          run.dispatch_recorded === 1
            ? "needs_reconciliation"
            : run.status === "cancel_requested"
              ? "cancelled"
              : "queued";
        const revision = run.revision + 1;
        this.#database
          .prepare(
            `UPDATE A008_platform_runs SET status = ?, revision = ?, updated_at = ?,
             lease_owner_token = NULL, lease_expires_at = NULL WHERE id = ?`,
          )
          .run(status, revision, now, run.id);
        this.#appendEvent(
          scope,
          run.conversation_id,
          run.id,
          "run.updated",
          revision,
          now,
        );
        recovered.push(this.#run(scope, run.id));
      }
    });
    return recovered;
  }

  readEvents(
    scope: PlatformScope,
    input: { readonly after?: number; readonly limit?: number } = {},
  ): PlatformEventPage {
    this.#requireOpen();
    this.#validateScope(scope);
    const after = input.after ?? 0;
    const limit = input.limit ?? 100;
    this.#safeInteger(after, "after");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new PlatformStoreError(
        "INVALID_REQUEST",
        "Event limit must be a safe integer from 1 through 1000.",
      );
    }
    const rows = this.#database
      .prepare(
        `SELECT * FROM A008_platform_events
         WHERE tenant_id = ? AND project_id = ? AND cursor > ? ORDER BY cursor LIMIT ?`,
      )
      .all(scope.tenantId, scope.projectId, after, limit + 1) as EventRow[];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const events = pageRows.map(eventFromRow);
    return { events, nextCursor: events.at(-1)?.cursor ?? after, hasMore };
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#ownsDatabase) this.#database.close();
  }

  #initializeSchema(): void {
    this.#immediate(() => {
      this.#database.exec(`CREATE TABLE IF NOT EXISTS A008_platform_schema (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1), version INTEGER NOT NULL
      )`);
      const existing = this.#database
        .prepare("SELECT version FROM A008_platform_schema WHERE singleton = 1")
        .get() as { readonly version: number } | undefined;
      if (existing !== undefined) {
        if (existing.version > PLATFORM_SQLITE_SCHEMA_VERSION) {
          throw new PlatformStoreError(
            "INVALID_REQUEST",
            "Platform SQLite database uses a future schema version.",
          );
        }
        if (existing.version === 1) {
          this.#database.exec("ALTER TABLE A008_platform_conversations ADD COLUMN workspace_id TEXT");
          this.#database.exec("ALTER TABLE A008_platform_runs ADD COLUMN workspace_id TEXT");
          const legacyWorkspaceId = "legacy-unbound";
          this.#database.prepare("UPDATE A008_platform_conversations SET workspace_id = ? WHERE workspace_id IS NULL").run(legacyWorkspaceId);
          this.#database.prepare("UPDATE A008_platform_runs SET workspace_id = ? WHERE workspace_id IS NULL").run(legacyWorkspaceId);
          this.#database.prepare("UPDATE A008_platform_schema SET version = ? WHERE singleton = 1").run(PLATFORM_SQLITE_SCHEMA_VERSION);
          return;
        }
        if (existing.version !== PLATFORM_SQLITE_SCHEMA_VERSION) throw new PlatformStoreError("INVALID_REQUEST", "Platform SQLite schema version is unsupported.");
        return;
      }
      this.#database.exec(PLATFORM_SQLITE_SCHEMA);
      this.#database
        .prepare(
          "INSERT INTO A008_platform_schema(singleton, version) VALUES (1, ?)",
        )
        .run(PLATFORM_SQLITE_SCHEMA_VERSION);
    });
  }

  #conversation(scope: PlatformScope, id: string): PlatformConversation {
    const row = this.#conversationRow(scope, id);
    const messages = this.#database
      .prepare(
        `SELECT id, role, content_json, created_at, run_id FROM A008_platform_messages
         WHERE conversation_id = ? ORDER BY created_at, id`,
      )
      .all(row.id) as MessageRow[];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      workspaceId: row.workspace_id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      revision: row.revision,
      messages: messages.map(messageFromRow),
    };
  }

  #conversationRow(scope: PlatformScope, id: string): ConversationRow {
    const row = this.#database
      .prepare(
        `SELECT * FROM A008_platform_conversations
         WHERE id = ? AND tenant_id = ? AND project_id = ?`,
      )
      .get(id, scope.tenantId, scope.projectId) as ConversationRow | undefined;
    if (row === undefined)
      throw new PlatformStoreError(
        "NOT_FOUND",
        "Conversation was not found in the trusted scope.",
      );
    return row;
  }

  #run(scope: PlatformScope, id: string): PlatformRun {
    return runFromRow(this.#runRow(scope, id));
  }

  #runRow(scope: PlatformScope, id: string): RunRow {
    const row = this.#database
      .prepare(
        `SELECT * FROM A008_platform_runs
         WHERE id = ? AND tenant_id = ? AND project_id = ?`,
      )
      .get(id, scope.tenantId, scope.projectId) as RunRow | undefined;
    if (row === undefined)
      throw new PlatformStoreError(
        "NOT_FOUND",
        "Run was not found in the trusted scope.",
      );
    return row;
  }

  #currentLease(
    scope: PlatformScope,
    input: Pick<LeaseWrite, "runId" | "ownerToken" | "generation">,
    now: number,
  ): RunRow {
    const run = this.#runRow(scope, input.runId);
    if (
      run.lease_owner_token !== input.ownerToken ||
      run.lease_generation !== input.generation ||
      run.lease_expires_at === null ||
      run.lease_expires_at <= now
    ) {
      throw new PlatformStoreError(
        "LEASE_LOST",
        "Run lease is no longer current and unexpired.",
      );
    }
    return run;
  }

  #leaseTransition(
    scope: PlatformScope,
    input: LeaseWrite,
    status: PlatformRunStatus,
    write: (run: RunRow, now: number) => void,
  ): PlatformRun {
    this.#requireOpen();
    this.#validateScope(scope);
    const now = this.#now();
    let result: PlatformRun | undefined;
    this.#immediate(() => {
      const run = this.#currentLease(scope, input, now);
      this.#requireRevision(run, input.expectedRevision);
      if (run.status !== status) {
        throw new PlatformStoreError(
          "REVISION_CONFLICT",
          `Run is ${run.status}, not ${status}.`,
        );
      }
      write(run, now);
      result = this.#run(scope, run.id);
    });
    return result!;
  }

  #appendEvent(
    scope: PlatformScope,
    conversationId: string,
    runId: string | null,
    type: PlatformEventType,
    revision: number,
    createdAt: number,
  ): void {
    this.#database
      .prepare(
        `INSERT INTO A008_platform_events
         (tenant_id, project_id, conversation_id, run_id, type, resource_revision, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        scope.tenantId,
        scope.projectId,
        conversationId,
        runId,
        type,
        revision,
        createdAt,
      );
  }

  #requireRevision(run: RunRow, expected: number): void {
    this.#safeInteger(expected, "expectedRevision");
    if (run.revision !== expected) {
      throw new PlatformStoreError(
        "REVISION_CONFLICT",
        "Run revision does not match.",
      );
    }
  }

  #canonicalRunCreate(input: AcceptPlatformRun): {
    readonly conversationId: string;
    readonly commandId: string;
    readonly expectedRevision: number;
    readonly model: string;
    readonly text: string;
    readonly payloadDigest: string;
  } {
    const conversationId = parseRuntimeId(input.conversationId, "conversation");
    const commandId = this.#bounded(input.commandId, "commandId", 1, 256);
    const model = this.#bounded(input.model, "model", 1, 256);
    const text = this.#bounded(input.text, "text", 1, 65536);
    this.#safeInteger(input.expectedRevision, "expectedRevision");
    return {
      conversationId,
      commandId,
      expectedRevision: input.expectedRevision,
      model,
      text,
      payloadDigest: digest({
        conversationId,
        expectedRevision: input.expectedRevision,
        model,
        text,
      }),
    };
  }

  #matchingReceipt(
    scope: PlatformScope,
    commandId: string,
    payloadDigest: string,
  ): AcceptedPlatformRun | undefined {
    const receipt = this.#database
      .prepare(
        `SELECT payload_digest, run_id FROM A008_platform_command_receipts
         WHERE tenant_id = ? AND principal_id = ? AND command_id = ?`,
      )
      .get(scope.tenantId, scope.principalId, commandId) as
      | ReceiptRow
      | undefined;
    if (receipt === undefined) return undefined;
    if (receipt.payload_digest !== payloadDigest) {
      throw new PlatformStoreError(
        "COMMAND_CONFLICT",
        "commandId was already accepted with a different run.create payload.",
      );
    }
    return { run: this.#run(scope, receipt.run_id), replayed: true };
  }

  #validateScope(scope: PlatformScope): void {
    this.#bounded(scope.tenantId, "tenantId", 1, 256);
    this.#bounded(scope.projectId, "projectId", 1, 256);
    this.#bounded(scope.principalId, "principalId", 1, 256);
  }

  #opaqueId(value: string | undefined, field: string, kind: string): string {
    return this.#bounded(
      value ?? `A008_platform_${kind}_${this.#idFactory()}`,
      field,
      1,
      256,
    );
  }

  #bounded(
    value: string,
    field: string,
    minimum: number,
    maximum: number,
  ): string {
    if (typeof value !== "string")
      throw new PlatformStoreError(
        "INVALID_REQUEST",
        `${field} must be a string.`,
      );
    const normalized = value.trim();
    if (normalized.length < minimum || normalized.length > maximum) {
      throw new PlatformStoreError(
        "INVALID_REQUEST",
        `${field} must contain ${minimum} through ${maximum} characters.`,
      );
    }
    return normalized;
  }

  #safeInteger(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new PlatformStoreError(
        "INVALID_REQUEST",
        `${field} must be a nonnegative safe integer.`,
      );
    }
  }

  #positiveInteger(value: number, field: string): void {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new PlatformStoreError(
        "INVALID_REQUEST",
        `${field} must be a positive safe integer.`,
      );
    }
  }

  #now(): number {
    const now = this.#clock();
    this.#safeInteger(now, "clock value");
    return now;
  }

  #requireOpen(): void {
    if (this.#closed)
      throw new PlatformStoreError(
        "INTERNAL_ERROR",
        "Platform store is closed.",
      );
  }

  #immediate<T>(work: () => T): T {
    return this.#database.transaction(work).immediate();
  }
}

function digest(payload: Record<string, string | number>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function messageFromRow(row: MessageRow): PlatformMessage {
  const content = chatContentSchema.parse(
    JSON.parse(row.content_json),
  ) as ChatContent;
  return {
    id: row.id,
    role: row.role,
    content,
    createdAt: row.created_at,
    ...(row.run_id === null ? {} : { runId: row.run_id }),
  };
}

function runFromRow(row: RunRow): PlatformRun {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    workspaceId: row.workspace_id,
    principalId: row.principal_id,
    commandId: row.command_id,
    model: row.model,
    status: row.status,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    leaseGeneration: row.lease_generation,
    effectStatus: row.effect_status,
    answerStatus: row.answer_status,
    memoryStatus: row.memory_status,
    ...(row.error_code === null || row.error_message === null
      ? {}
      : { error: { code: row.error_code, message: row.error_message } }),
  };
}

function eventFromRow(row: EventRow): PlatformEvent {
  return {
    cursor: row.cursor,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    conversationId: row.conversation_id,
    ...(row.run_id === null ? {} : { runId: row.run_id }),
    type: row.type,
    resourceRevision: row.resource_revision,
    createdAt: row.created_at,
  };
}

function isRunStatus(value: string): value is PlatformRunStatus {
  return [
    "queued",
    "running",
    "cancel_requested",
    "needs_reconciliation",
    "succeeded",
    "failed",
    "cancelled",
  ].includes(value);
}
