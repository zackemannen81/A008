import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { MemoryError } from "./errors.js";
import { InMemoryMemoryRepository } from "./in-memory-repository.js";
import type {
  CandidateChannelHit,
  CandidateChannelLimits,
  CandidateSearchResult,
  MemoryCandidateStore,
  RetrievalChannel,
  RetrievalDocument,
  RetrievalPlan,
  SemanticQueryVector,
} from "./retrieval-types.js";
import type {
  KnowledgeItem,
  MemoryAuditEvent,
  MemoryReadView,
  MemoryRepository,
  MemoryTransaction,
} from "./types.js";
import { parseRuntimeId } from "../identity/runtime-id.js";
import type { ProjectId } from "../identity/types.js";

const SQLITE_SCHEMA_VERSION = 1;
const CHANNELS: readonly RetrievalChannel[] = [
  "exact",
  "lexical",
  "tag",
  "domain",
  "semantic",
];

export interface SqliteMemoryRepositoryOptions {
  readonly filename: string;
  readonly projectId: ProjectId;
}

interface KnowledgeRow {
  readonly id: string;
  readonly payload_json: string;
}

interface AuditRow {
  readonly payload_json: string;
}

interface IdRow {
  readonly knowledge_id: string;
}

interface IdValueRow extends IdRow {
  readonly value: string;
}

interface FtsRow extends IdRow {
  readonly rank: number;
}

interface EmbeddingRow extends IdRow {
  readonly embedding_model: string;
  readonly embedding_json: string;
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new MemoryError("invalid_input", `${field} must not be empty`);
  }
  return normalized;
}

function normalizeValues(values: readonly string[], field: string): string[] {
  const normalized = values.map((value) =>
    requireNonEmpty(value, field).toLocaleLowerCase("und"),
  );
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

function validateVector(vector: readonly number[], field: string): number[] {
  if (vector.length === 0) {
    throw new MemoryError("invalid_input", `${field} must not be empty`);
  }
  const normalized = vector.map((value) => Number(value));
  if (normalized.some((value) => !Number.isFinite(value))) {
    throw new MemoryError("invalid_input", `${field} must contain finite numbers`);
  }
  const norm = Math.sqrt(normalized.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    throw new MemoryError("invalid_input", `${field} must have a non-zero norm`);
  }
  return normalized;
}

function parseItem(row: KnowledgeRow): KnowledgeItem {
  try {
    return JSON.parse(row.payload_json) as KnowledgeItem;
  } catch (error) {
    throw new MemoryError(
      "illegal_state",
      `stored knowledge is not valid JSON: ${row.id}`,
      { cause: error },
    );
  }
}

function parseAudit(row: AuditRow): MemoryAuditEvent {
  try {
    return JSON.parse(row.payload_json) as MemoryAuditEvent;
  } catch (error) {
    throw new MemoryError("illegal_state", "stored audit event is not valid JSON", {
      cause: error,
    });
  }
}

function cloneItem(item: KnowledgeItem): KnowledgeItem {
  return {
    ...item,
    tags: [...item.tags],
    scope: [...item.scope],
    provenance: item.provenance.map((entry) => ({ ...entry })),
  };
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return -1;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return -1;
  }
  return dot / Math.sqrt(leftNorm * rightNorm);
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function boundedLimit(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MemoryError(
      "invalid_input",
      `${field} must be a positive safe integer`,
    );
  }
  return value;
}

function normalizedLabelWeights(
  labels: readonly { readonly value: string; readonly weight: number }[],
  field: string,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const label of labels) {
    const value = requireNonEmpty(label.value, field).toLocaleLowerCase("und");
    if (!Number.isFinite(label.weight) || label.weight < 0 || label.weight > 1) {
      throw new MemoryError(
        "invalid_input",
        `${field} weight must be a finite number between 0 and 1`,
      );
    }
    result.set(value, Math.max(result.get(value) ?? 0, label.weight));
  }
  return result;
}

function scopeClause(alias: string, scopes: readonly string[]): {
  readonly sql: string;
  readonly parameters: readonly string[];
} {
  if (scopes.length === 0) {
    return {
      sql: `json_array_length(json_extract(${alias}.payload_json, '$.scope')) = 0`,
      parameters: [],
    };
  }
  return {
    sql: `(json_array_length(json_extract(${alias}.payload_json, '$.scope')) = 0 OR EXISTS (
      SELECT 1 FROM json_each(json_extract(${alias}.payload_json, '$.scope')) AS scope_value
      WHERE lower(scope_value.value) IN (${placeholders(scopes.length)})
    ))`,
    parameters: scopes,
  };
}

class SqliteReadView implements MemoryReadView {
  constructor(
    private readonly database: BetterSqliteDatabase,
    private readonly namespace: string,
  ) {}

  get(id: string): KnowledgeItem | undefined {
    const row = this.database
      .prepare(
        "SELECT id, payload_json FROM A008_memory_knowledge WHERE namespace = ? AND id = ?",
      )
      .get(this.namespace, id) as KnowledgeRow | undefined;
    return row === undefined ? undefined : cloneItem(parseItem(row));
  }

  list(ids: readonly string[]): readonly KnowledgeItem[] {
    if (ids.length === 0) {
      return [];
    }
    const rows = this.database
      .prepare(
        `SELECT id, payload_json FROM A008_memory_knowledge
         WHERE namespace = ? AND id IN (${placeholders(ids.length)})`,
      )
      .all(this.namespace, ...ids) as KnowledgeRow[];
    const byId = new Map(rows.map((row) => [row.id, parseItem(row)]));
    return ids
      .map((id) => byId.get(id))
      .filter((item): item is KnowledgeItem => item !== undefined)
      .map(cloneItem);
  }

  listKeepAlive(): readonly KnowledgeItem[] {
    return this.queryItems(
      "canonical_status = 'current' AND keep_alive = 1",
    );
  }

  listCurrent(): readonly KnowledgeItem[] {
    return this.queryItems("canonical_status = 'current'");
  }

  listAll(): readonly KnowledgeItem[] {
    return this.queryItems("1 = 1");
  }

  historyFrom(id: string): readonly KnowledgeItem[] {
    const history: KnowledgeItem[] = [];
    const visited = new Set<string>();
    let nextId: string | null = id;
    while (nextId !== null) {
      if (visited.has(nextId)) {
        throw new MemoryError(
          "illegal_state",
          `supersede cycle detected at ${nextId}`,
        );
      }
      visited.add(nextId);
      const item = this.get(nextId);
      if (item === undefined) {
        break;
      }
      history.push(item);
      nextId = item.supersededBy;
    }
    return history;
  }

  private queryItems(predicate: string): readonly KnowledgeItem[] {
    const rows = this.database
      .prepare(
        `SELECT id, payload_json FROM A008_memory_knowledge
         WHERE namespace = ? AND ${predicate} ORDER BY id`,
      )
      .all(this.namespace) as KnowledgeRow[];
    return rows.map((row) => cloneItem(parseItem(row)));
  }
}

export class SqliteMemoryRepository
  implements MemoryRepository, MemoryCandidateStore
{
  readonly projectId: ProjectId;
  readonly schemaVersion = SQLITE_SCHEMA_VERSION;
  private readonly namespace: string;
  private readonly database: BetterSqliteDatabase;
  private transactionTail: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(options: SqliteMemoryRepositoryOptions) {
    const filename = requireNonEmpty(options.filename, "SQLite filename");
    this.projectId = parseRuntimeId(options.projectId, "project");
    this.namespace = this.projectId;
    this.database = new Database(filename, { timeout: 5_000 });
    try {
      this.database.pragma("foreign_keys = ON");
      if (filename !== ":memory:") {
        this.database.pragma("journal_mode = WAL");
      }
      this.initializeSchema();
      this.validateStoredState();
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  async read<T>(reader: (view: MemoryReadView) => T | Promise<T>): Promise<T> {
    this.requireOpen();
    await this.transactionTail;
    return reader(new SqliteReadView(this.database, this.namespace));
  }

  async transact<T>(
    operation: (transaction: MemoryTransaction) => T | Promise<T>,
  ): Promise<T> {
    this.requireOpen();
    const previous = this.transactionTail;
    let release: () => void = () => undefined;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const beforeItems = this.loadAllItems();
      const working = new InMemoryMemoryRepository(
        beforeItems,
        this.loadAudit(),
      );
      const result = await working.transact(operation);
      const afterItems = await working.read((view) => view.listAll());
      const afterAudit = await working.readAudit();
      this.persistSnapshot(beforeItems, afterItems, afterAudit);
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      release();
    }
  }

  async readAudit(): Promise<readonly MemoryAuditEvent[]> {
    this.requireOpen();
    await this.transactionTail;
    return this.loadAudit().map((event) => ({
      ...event,
      knowledgeIds: [...event.knowledgeIds],
      selectedKnowledgeIds: [...event.selectedKnowledgeIds],
    }));
  }

  async upsertRetrievalDocument(document: RetrievalDocument): Promise<void> {
    this.requireOpen();
    const knowledgeId = requireNonEmpty(document.knowledgeId, "knowledgeId");
    const entities = normalizeValues(document.entities ?? [], "entity");
    const domains = normalizeValues(document.domains ?? [], "domain");
    const embedding =
      document.embedding === undefined
        ? null
        : validateVector(document.embedding, "embedding");
    const embeddingModel =
      embedding === null
        ? null
        : requireNonEmpty(document.embeddingModel ?? "", "embeddingModel");

    const previous = this.transactionTail;
    let release: () => void = () => undefined;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.database
        .prepare(
          `SELECT id, revision FROM A008_memory_knowledge
           WHERE namespace = ? AND id = ? AND canonical_status = 'current'`,
        )
        .get(this.namespace, knowledgeId) as
        | { readonly id: string; readonly revision: number }
        | undefined;
      if (row === undefined) {
        throw new MemoryError(
          "missing_target",
          `retrieval document target is not current knowledge: ${knowledgeId}`,
        );
      }
      this.database
        .prepare(
          `INSERT INTO A008_memory_retrieval_documents
             (namespace, knowledge_id, entities_json, domains_json,
              embedding_model, embedding_json, indexed_revision)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(namespace, knowledge_id) DO UPDATE SET
             entities_json = excluded.entities_json,
             domains_json = excluded.domains_json,
             embedding_model = excluded.embedding_model,
             embedding_json = excluded.embedding_json,
             indexed_revision = excluded.indexed_revision`,
        )
        .run(
          this.namespace,
          knowledgeId,
          JSON.stringify(entities),
          JSON.stringify(domains),
          embeddingModel,
          embedding === null ? null : JSON.stringify(embedding),
          row.revision,
        );
      this.database
        .prepare(
          "DELETE FROM A008_memory_entities WHERE namespace = ? AND knowledge_id = ?",
        )
        .run(this.namespace, knowledgeId);
      this.database
        .prepare(
          "DELETE FROM A008_memory_domains WHERE namespace = ? AND knowledge_id = ?",
        )
        .run(this.namespace, knowledgeId);
      const insertEntity = this.database.prepare(
        "INSERT INTO A008_memory_entities(namespace, knowledge_id, value) VALUES (?, ?, ?)",
      );
      for (const entity of entities) {
        insertEntity.run(this.namespace, knowledgeId, entity);
      }
      const insertDomain = this.database.prepare(
        "INSERT INTO A008_memory_domains(namespace, knowledge_id, value) VALUES (?, ?, ?)",
      );
      for (const domain of domains) {
        insertDomain.run(this.namespace, knowledgeId, domain);
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      release();
    }
  }

  async retrieveCandidates(
    plan: RetrievalPlan,
    semanticVectors: readonly SemanticQueryVector[],
    limits: CandidateChannelLimits,
  ): Promise<CandidateSearchResult> {
    this.requireOpen();
    if (plan.projectId !== this.projectId) {
      throw new MemoryError(
        "invalid_input",
        "retrieval plan project does not match repository namespace",
      );
    }
    await this.transactionTail;
    const scopes = normalizeValues(plan.applicabilityScopes, "applicability scope");
    const boundedLimits: CandidateChannelLimits = {
      exact: boundedLimit(limits.exact, "limits.exact"),
      lexical: boundedLimit(limits.lexical, "limits.lexical"),
      tag: boundedLimit(limits.tag, "limits.tag"),
      domain: boundedLimit(limits.domain, "limits.domain"),
      semantic: boundedLimit(limits.semantic, "limits.semantic"),
    };
    const hits: CandidateChannelHit[] = [];
    hits.push(...this.retrieveExact(plan, scopes, boundedLimits.exact));
    hits.push(...this.retrieveLexical(plan, scopes, boundedLimits.lexical));
    hits.push(...this.retrieveTags(plan, scopes, boundedLimits.tag));
    hits.push(...this.retrieveDomains(plan, scopes, boundedLimits.domain));
    hits.push(
      ...this.retrieveSemantic(scopes, semanticVectors, boundedLimits.semantic),
    );
    const channelCounts = Object.fromEntries(
      CHANNELS.map((channel) => [
        channel,
        hits.filter((hit) => hit.channel === channel).length,
      ]),
    ) as Record<RetrievalChannel, number>;
    const count = this.database
      .prepare(
        `SELECT count(*) AS count FROM A008_memory_knowledge
         WHERE namespace = ? AND canonical_status = 'current'`,
      )
      .get(this.namespace) as { readonly count: number };
    return {
      persistentCurrentCount: Number(count.count),
      hits,
      channelCounts,
    };
  }

  close(): void {
    if (!this.closed) {
      this.database.close();
      this.closed = true;
    }
  }

  private initializeSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS A008_memory_schema (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        version INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO A008_memory_schema(singleton, version)
        VALUES (1, ${SQLITE_SCHEMA_VERSION});

      CREATE TABLE IF NOT EXISTS A008_memory_knowledge (
        namespace TEXT NOT NULL,
        id TEXT NOT NULL,
        payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
        canonical_status TEXT NOT NULL,
        activation_status TEXT NOT NULL,
        keep_alive INTEGER NOT NULL CHECK (keep_alive IN (0, 1)),
        revision INTEGER NOT NULL,
        PRIMARY KEY(namespace, id)
      );
      CREATE INDEX IF NOT EXISTS A008_memory_knowledge_current_idx
        ON A008_memory_knowledge(namespace, canonical_status, keep_alive, id);

      CREATE TABLE IF NOT EXISTS A008_memory_audit (
        namespace TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
        PRIMARY KEY(namespace, sequence)
      );

      CREATE TABLE IF NOT EXISTS A008_memory_retrieval_documents (
        namespace TEXT NOT NULL,
        knowledge_id TEXT NOT NULL,
        entities_json TEXT NOT NULL CHECK (json_valid(entities_json)),
        domains_json TEXT NOT NULL CHECK (json_valid(domains_json)),
        embedding_model TEXT,
        embedding_json TEXT CHECK (embedding_json IS NULL OR json_valid(embedding_json)),
        indexed_revision INTEGER NOT NULL,
        PRIMARY KEY(namespace, knowledge_id),
        FOREIGN KEY(namespace, knowledge_id)
          REFERENCES A008_memory_knowledge(namespace, id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS A008_memory_entities (
        namespace TEXT NOT NULL,
        knowledge_id TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY(namespace, knowledge_id, value),
        FOREIGN KEY(namespace, knowledge_id)
          REFERENCES A008_memory_knowledge(namespace, id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS A008_memory_entities_value_idx
        ON A008_memory_entities(namespace, value, knowledge_id);

      CREATE TABLE IF NOT EXISTS A008_memory_domains (
        namespace TEXT NOT NULL,
        knowledge_id TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY(namespace, knowledge_id, value),
        FOREIGN KEY(namespace, knowledge_id)
          REFERENCES A008_memory_knowledge(namespace, id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS A008_memory_domains_value_idx
        ON A008_memory_domains(namespace, value, knowledge_id);

      CREATE TABLE IF NOT EXISTS A008_memory_tags (
        namespace TEXT NOT NULL,
        knowledge_id TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY(namespace, knowledge_id, value),
        FOREIGN KEY(namespace, knowledge_id)
          REFERENCES A008_memory_knowledge(namespace, id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS A008_memory_tags_value_idx
        ON A008_memory_tags(namespace, value, knowledge_id);

      CREATE VIRTUAL TABLE IF NOT EXISTS A008_memory_fts USING fts5(
        namespace UNINDEXED,
        knowledge_id UNINDEXED,
        proposition,
        kind,
        tags,
        scopes,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `);
    const version = this.database
      .prepare("SELECT version FROM A008_memory_schema WHERE singleton = 1")
      .get() as { readonly version: number } | undefined;
    if (version?.version !== SQLITE_SCHEMA_VERSION) {
      throw new MemoryError(
        "illegal_state",
        `unsupported SQLite memory schema version: ${String(version?.version)}`,
      );
    }
  }

  private validateStoredState(): void {
    new InMemoryMemoryRepository(this.loadAllItems(), this.loadAudit());
  }

  private requireOpen(): void {
    if (this.closed) {
      throw new MemoryError("illegal_state", "SQLite memory repository is closed");
    }
  }

  private loadAllItems(): KnowledgeItem[] {
    return (
      this.database
        .prepare(
          `SELECT id, payload_json FROM A008_memory_knowledge
           WHERE namespace = ? ORDER BY id`,
        )
        .all(this.namespace) as KnowledgeRow[]
    ).map(parseItem);
  }

  private loadAudit(): MemoryAuditEvent[] {
    return (
      this.database
        .prepare(
          `SELECT payload_json FROM A008_memory_audit
           WHERE namespace = ? ORDER BY sequence`,
        )
        .all(this.namespace) as AuditRow[]
    ).map(parseAudit);
  }

  private persistSnapshot(
    beforeItems: readonly KnowledgeItem[],
    afterItems: readonly KnowledgeItem[],
    audit: readonly MemoryAuditEvent[],
  ): void {
    const beforeById = new Map(beforeItems.map((item) => [item.id, item]));
    const afterIds = new Set(afterItems.map((item) => item.id));
    const deleteKnowledge = this.database.prepare(
      "DELETE FROM A008_memory_knowledge WHERE namespace = ? AND id = ?",
    );
    for (const before of beforeItems) {
      if (!afterIds.has(before.id)) {
        deleteKnowledge.run(this.namespace, before.id);
      }
    }

    const upsertKnowledge = this.database.prepare(`
      INSERT INTO A008_memory_knowledge
        (namespace, id, payload_json, canonical_status, activation_status,
         keep_alive, revision)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(namespace, id) DO UPDATE SET
        payload_json = excluded.payload_json,
        canonical_status = excluded.canonical_status,
        activation_status = excluded.activation_status,
        keep_alive = excluded.keep_alive,
        revision = excluded.revision
    `);
    const deleteRetrieval = this.database.prepare(
      "DELETE FROM A008_memory_retrieval_documents WHERE namespace = ? AND knowledge_id = ?",
    );
    const deleteEntities = this.database.prepare(
      "DELETE FROM A008_memory_entities WHERE namespace = ? AND knowledge_id = ?",
    );
    const deleteDomains = this.database.prepare(
      "DELETE FROM A008_memory_domains WHERE namespace = ? AND knowledge_id = ?",
    );
    for (const item of afterItems) {
      const before = beforeById.get(item.id);
      upsertKnowledge.run(
        this.namespace,
        item.id,
        JSON.stringify(item),
        item.canonicalStatus,
        item.activationStatus,
        item.keepAlive ? 1 : 0,
        item.revision,
      );
      if (before !== undefined && before.proposition !== item.proposition) {
        deleteRetrieval.run(this.namespace, item.id);
        deleteEntities.run(this.namespace, item.id);
        deleteDomains.run(this.namespace, item.id);
      } else if (before !== undefined && before.revision !== item.revision) {
        this.database
          .prepare(
            `UPDATE A008_memory_retrieval_documents
             SET indexed_revision = ?
             WHERE namespace = ? AND knowledge_id = ?`,
          )
          .run(item.revision, this.namespace, item.id);
      }
    }

    this.database
      .prepare("DELETE FROM A008_memory_audit WHERE namespace = ?")
      .run(this.namespace);
    const insertAudit = this.database.prepare(
      `INSERT INTO A008_memory_audit(namespace, sequence, payload_json)
       VALUES (?, ?, ?)`,
    );
    for (const event of audit) {
      insertAudit.run(this.namespace, event.sequence, JSON.stringify(event));
    }
    this.rebuildDerivedIndex(afterItems);
  }

  private rebuildDerivedIndex(items: readonly KnowledgeItem[]): void {
    this.database
      .prepare("DELETE FROM A008_memory_fts WHERE namespace = ?")
      .run(this.namespace);
    this.database
      .prepare("DELETE FROM A008_memory_tags WHERE namespace = ?")
      .run(this.namespace);
    const insertFts = this.database.prepare(
      `INSERT INTO A008_memory_fts
         (namespace, knowledge_id, proposition, kind, tags, scopes)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertTag = this.database.prepare(
      "INSERT INTO A008_memory_tags(namespace, knowledge_id, value) VALUES (?, ?, ?)",
    );
    for (const item of items) {
      if (item.canonicalStatus !== "current") {
        continue;
      }
      insertFts.run(
        this.namespace,
        item.id,
        item.proposition,
        item.kind,
        item.tags.join(" "),
        item.scope.join(" "),
      );
      for (const tag of normalizeValues(item.tags, "knowledge tag")) {
        insertTag.run(this.namespace, item.id, tag);
      }
    }
  }

  private retrieveExact(
    plan: RetrievalPlan,
    scopes: readonly string[],
    limit: number,
  ): CandidateChannelHit[] {
    const entities = normalizeValues(plan.entities, "entity");
    if (entities.length === 0) {
      return [];
    }
    const scope = scopeClause("k", scopes);
    const rows = this.database
      .prepare(
        `SELECT DISTINCT e.knowledge_id
         FROM A008_memory_entities e
         JOIN A008_memory_knowledge k
           ON k.namespace = e.namespace AND k.id = e.knowledge_id
         WHERE e.namespace = ?
           AND e.value IN (${placeholders(entities.length)})
           AND k.canonical_status = 'current'
           AND ${scope.sql}
         ORDER BY e.knowledge_id
         LIMIT ?`,
      )
      .all(this.namespace, ...entities, ...scope.parameters, limit) as IdRow[];
    return rows.map((row) => ({
      knowledgeId: row.knowledge_id,
      channel: "exact",
      score: 1,
      reason: "indexed entity matched exactly",
    }));
  }

  private retrieveLexical(
    plan: RetrievalPlan,
    scopes: readonly string[],
    limit: number,
  ): CandidateChannelHit[] {
    const terms = normalizeValues(plan.terms, "term");
    if (terms.length === 0) {
      return [];
    }
    const query = terms
      .map((term) => `"${term.replaceAll('"', '""')}"`)
      .join(" OR ");
    const scope = scopeClause("k", scopes);
    const rows = this.database
      .prepare(
        `SELECT f.knowledge_id, bm25(A008_memory_fts) AS rank
         FROM A008_memory_fts f
         JOIN A008_memory_knowledge k
           ON k.namespace = f.namespace AND k.id = f.knowledge_id
         WHERE A008_memory_fts MATCH ?
           AND f.namespace = ?
           AND k.canonical_status = 'current'
           AND ${scope.sql}
         ORDER BY rank, f.knowledge_id
         LIMIT ?`,
      )
      .all(query, this.namespace, ...scope.parameters, limit) as FtsRow[];
    return rows.map((row, index) => ({
      knowledgeId: row.knowledge_id,
      channel: "lexical",
      score: 1 / (index + 1),
      reason: "SQLite FTS5 lexical match",
    }));
  }

  private retrieveTags(
    plan: RetrievalPlan,
    scopes: readonly string[],
    limit: number,
  ): CandidateChannelHit[] {
    const tagWeights = normalizedLabelWeights(plan.tags, "tag");
    const tags = normalizeValues([...tagWeights.keys()], "tag");
    if (tags.length === 0) {
      return [];
    }
    const scope = scopeClause("k", scopes);
    const rows = this.database
      .prepare(
        `SELECT DISTINCT t.knowledge_id, t.value
         FROM A008_memory_tags t
         JOIN A008_memory_knowledge k
           ON k.namespace = t.namespace AND k.id = t.knowledge_id
         WHERE t.namespace = ?
           AND t.value IN (${placeholders(tags.length)})
           AND k.canonical_status = 'current'
           AND ${scope.sql}
         ORDER BY t.knowledge_id
         LIMIT ?`,
      )
      .all(this.namespace, ...tags, ...scope.parameters, limit) as IdValueRow[];
    return rows.map((row) => ({
      knowledgeId: row.knowledge_id,
      channel: "tag",
      score: tagWeights.get(row.value) ?? 0,
      reason: "canonical tag matched retrieval plan",
    }));
  }

  private retrieveDomains(
    plan: RetrievalPlan,
    scopes: readonly string[],
    limit: number,
  ): CandidateChannelHit[] {
    const domainWeights = normalizedLabelWeights(plan.domains, "domain");
    const domains = normalizeValues([...domainWeights.keys()], "domain");
    if (domains.length === 0) {
      return [];
    }
    const scope = scopeClause("k", scopes);
    const rows = this.database
      .prepare(
        `SELECT DISTINCT d.knowledge_id, d.value
         FROM A008_memory_domains d
         JOIN A008_memory_knowledge k
           ON k.namespace = d.namespace AND k.id = d.knowledge_id
         WHERE d.namespace = ?
           AND d.value IN (${placeholders(domains.length)})
           AND k.canonical_status = 'current'
           AND ${scope.sql}
         ORDER BY d.knowledge_id
         LIMIT ?`,
      )
      .all(this.namespace, ...domains, ...scope.parameters, limit) as IdValueRow[];
    return rows.map((row) => ({
      knowledgeId: row.knowledge_id,
      channel: "domain",
      score: domainWeights.get(row.value) ?? 0,
      reason: "indexed domain matched retrieval plan",
    }));
  }

  private retrieveSemantic(
    scopes: readonly string[],
    vectors: readonly SemanticQueryVector[],
    limit: number,
  ): CandidateChannelHit[] {
    if (vectors.length === 0) {
      return [];
    }
    const validated = vectors.map((entry, index) => ({
      model: requireNonEmpty(entry.model, `semantic vector ${index} model`),
      vector: validateVector(entry.vector, `semantic vector ${index}`),
    }));
    const models = [...new Set(validated.map((entry) => entry.model))];
    const scope = scopeClause("k", scopes);
    const rows = this.database
      .prepare(
        `SELECT d.knowledge_id, d.embedding_model, d.embedding_json
         FROM A008_memory_retrieval_documents d
         JOIN A008_memory_knowledge k
           ON k.namespace = d.namespace AND k.id = d.knowledge_id
         WHERE d.namespace = ?
           AND d.embedding_json IS NOT NULL
           AND d.embedding_model IN (${placeholders(models.length)})
           AND d.indexed_revision = k.revision
           AND k.canonical_status = 'current'
           AND ${scope.sql}`,
      )
      .all(this.namespace, ...models, ...scope.parameters) as EmbeddingRow[];
    return rows
      .map((row) => {
        const stored = validateVector(
          JSON.parse(row.embedding_json) as number[],
          `stored embedding ${row.knowledge_id}`,
        );
        const score = Math.max(
          ...validated
            .filter((entry) => entry.model === row.embedding_model)
            .map((entry) => cosineSimilarity(stored, entry.vector)),
        );
        return { row, score };
      })
      .filter((entry) => entry.score >= 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.row.knowledge_id.localeCompare(right.row.knowledge_id),
      )
      .slice(0, limit)
      .map(({ row, score }) => ({
        knowledgeId: row.knowledge_id,
        channel: "semantic" as const,
        score,
        reason: `cosine similarity from ${row.embedding_model}`,
      }));
  }
}
