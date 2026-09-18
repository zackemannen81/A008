import { insertKnowledgeSnapshot, updateKnowledgeSnapshot } from "./sqlite-rows.js";
import { AssociationLifecycle, type AssociationRecord, type AssociationReceipt, type AssociationTransition, type AssociationSnapshot } from "./association-lifecycle.js";
import { migrateLegacyLifecycle, operationalTime, validateLifecycle } from "./lifecycle.js";
import type { ReinforcementReceipt } from "./lifecycle-types.js";
import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { parseRuntimeId } from "../../identity/runtime-id.js";
import type { ProjectId } from "../../identity/types.js";
import type { KnowledgeItem } from "../types.js";
import {
  deserializeInstant,
  UNKNOWN_INSTANT,
} from "./clocks.js";
import { KnowledgeModelError } from "./errors.js";
import type { Claim, ProvenanceRecord, Utterance } from "./evidence-types.js";
import { asArtifactId, asEntityId } from "./ids.js";
import type {
  LifecycleRecord,
  LifecycleSnapshot,
  LifecycleTransition,
} from "./lifecycle-types.js";
import type { LabelRecord } from "./labels.js";
import type { RelationLink } from "./expand.js";
import type {
  Binding,
  CorrectionRecord,
  KnowledgeStateSnapshot,
  SlotClaim,
  StateTransition,
  StubEvent,
} from "./state-types.js";
import type {
  Artifact,
  Entity,
  Instant,
  Interval,
  SlotDefinition,
} from "./types.js";
import {
  KNOWLEDGE_SQLITE_SCHEMA,
  KNOWLEDGE_SQLITE_SCHEMA_VERSION,
} from "./sqlite-schema.js";

export interface SqliteKnowledgeStoreOptions {
  readonly clock?: () => string;
  readonly filename: string;
  readonly projectId: ProjectId;
  readonly database?: BetterSqliteDatabase;
}

export interface KnowledgeNamespaceSnapshot {
  readonly associations?: AssociationSnapshot;
  readonly entities: readonly Entity[];
  readonly slots: readonly SlotDefinition[];
  readonly state: KnowledgeStateSnapshot;
  readonly stateNextTransition: number;
  readonly artifacts: readonly Artifact[];
  readonly utterances: readonly Utterance[];
  readonly claims: readonly Claim[];
  readonly provenance: readonly ProvenanceRecord[];
  readonly labels: readonly LabelRecord[];
  readonly lifecycle: LifecycleSnapshot;
  readonly lifecycleNextTransition: number;
  readonly relations: readonly RelationLink[];
}

interface PayloadRow {
  readonly payload_json: string;
}

interface MetaRow {
  readonly state_next_transition: number;
  readonly lifecycle_next_transition: number;
}

interface BindingRow {
  readonly payload_json: string;
  readonly valid_from: string;
  readonly valid_to: string | null;
}

interface RelationRow {
  readonly from_id: string;
  readonly to_id: string;
  readonly relation: string;
}

interface KnowledgeItemRow {
  readonly id: string;
  readonly payload_json: string;
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new KnowledgeModelError("invalid_input", `${field} must not be empty`);
  }
  return normalized;
}

function parseJson<T>(raw: string, field: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (cause) {
    throw new KnowledgeModelError(
      "invalid_input",
      `${field} is not valid JSON`,
      { cause },
    );
  }
}

function readInstant(raw: string): Instant {
  return deserializeInstant(raw);
}

function intervalFromColumns(fromRaw: string, toRaw: string | null): Interval {
  return {
    from: readInstant(fromRaw),
    to: toRaw === null ? null : readInstant(toRaw),
  };
}

export class SqliteKnowledgeStore {
  readonly projectId: ProjectId;
  readonly schemaVersion = KNOWLEDGE_SQLITE_SCHEMA_VERSION;
  readonly filename: string;
  private readonly namespace: string;
  private readonly database: BetterSqliteDatabase;
  private readonly ownsDatabase: boolean;
  private closed = false;
  private readonly clock: () => string;
  revision(): string {
    const local = this.database.prepare("SELECT total_changes() AS n").get() as { n: number };
    return `${this.database.pragma("data_version", { simple: true })}:${local.n}`;
  }
  revisionAfterCommit(lockedRevision: string): string {
    const local = this.database.prepare("SELECT total_changes() AS n").get() as { n: number };
    // Preserve the external version observed under the write lock. Reading a
    // newer data_version after releasing it could hide another owner's commit.
    return `${lockedRevision.split(":")[0]}:${local.n}`;
  }
  atomic<T>(operation: () => T): T { this.requireOpen(); return this.database.transaction(operation).immediate(); }

  constructor(options: SqliteKnowledgeStoreOptions) {
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.filename = requireNonEmpty(options.filename, "SQLite filename");
    this.projectId = parseRuntimeId(options.projectId, "project");
    this.namespace = this.projectId;
    this.ownsDatabase = options.database === undefined;
    this.database =
      options.database ??
      new Database(this.filename, { timeout: 5_000 });
    try {
      this.database.pragma("foreign_keys = ON");
      if (this.filename !== ":memory:") {
        this.database.pragma("journal_mode = WAL");
      }
      this.database.transaction(() => {
        this.database.exec(KNOWLEDGE_SQLITE_SCHEMA);
        this.migrateSchemaVersion();
        this.assertSchemaVersion();
      }).immediate();
    } catch (error) {
      if (this.ownsDatabase) {
        this.database.close();
      }
      throw error;
    }
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.ownsDatabase) {
      this.database.close();
    }
  }

  migrateV0SupersedeChains(): {
    readonly chainsMigrated: number;
    readonly skipped: boolean;
  } {
    this.requireOpen();
    const existing = this.database
      .prepare(
        "SELECT status FROM A008_knowledge_migration WHERE namespace = ?",
      )
      .get(this.namespace) as { readonly status: string } | undefined;
    if (existing?.status === "complete") {
      return { chainsMigrated: 0, skipped: true };
    }
    if (!this.v0TableExists()) {
      this.database
        .prepare(
          `INSERT INTO A008_knowledge_migration(namespace, from_schema, status, chains_migrated)
           VALUES (?, 'A008_memory_knowledge', 'complete', 0)
           ON CONFLICT(namespace) DO UPDATE SET
             status = excluded.status,
             chains_migrated = excluded.chains_migrated`,
        )
        .run(this.namespace);
      return { chainsMigrated: 0, skipped: true };
    }
    const snapshot = this.load();
    const migrated = migrateV0Items(this.loadV0Items(), snapshot);
    const migrationAt = this.clock();
    this.replaceNamespace({ ...migrated.snapshot, lifecycle: { ...migrated.snapshot.lifecycle, records: migrated.snapshot.lifecycle.records.map(r => migrateLegacyLifecycle(r, migrationAt)) } });
    this.database
      .prepare(
        `INSERT INTO A008_knowledge_migration(namespace, from_schema, status, chains_migrated)
         VALUES (?, 'A008_memory_knowledge', 'complete', ?)
         ON CONFLICT(namespace) DO UPDATE SET
           status = excluded.status,
           chains_migrated = excluded.chains_migrated`,
      )
      .run(this.namespace, migrated.chainsMigrated);
    return { chainsMigrated: migrated.chainsMigrated, skipped: false };
  }

  load(): KnowledgeNamespaceSnapshot {
    this.requireOpen();
    const meta = this.database
      .prepare(
        `SELECT state_next_transition, lifecycle_next_transition
         FROM A008_knowledge_meta WHERE namespace = ?`,
      )
      .get(this.namespace) as MetaRow | undefined;
    const entities = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_entities WHERE namespace = ? ORDER BY id",
      )
      .all(this.namespace) as PayloadRow[];
    const slots = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_slots WHERE namespace = ? ORDER BY slot_key",
      )
      .all(this.namespace) as PayloadRow[];
    const bindings = this.database
      .prepare(
        `SELECT payload_json, valid_from, valid_to
         FROM A008_knowledge_bindings
         WHERE namespace = ?
         ORDER BY slot_key, claim_id, valid_from`,
      )
      .all(this.namespace) as BindingRow[];
    const transitions = this.database
      .prepare(
        `SELECT payload_json FROM A008_knowledge_transitions
         WHERE namespace = ? ORDER BY seq, id`,
      )
      .all(this.namespace) as PayloadRow[];
    const claims = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_slot_claims WHERE namespace = ? ORDER BY id",
      )
      .all(this.namespace) as PayloadRow[];
    const events = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_events WHERE namespace = ? ORDER BY id",
      )
      .all(this.namespace) as PayloadRow[];
    const corrections = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_corrections WHERE namespace = ? ORDER BY transition_id",
      )
      .all(this.namespace) as PayloadRow[];
    const contested = this.database
      .prepare(
        "SELECT slot_key FROM A008_knowledge_contested WHERE namespace = ? ORDER BY slot_key",
      )
      .all(this.namespace) as { readonly slot_key: string }[];
    const artifacts = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_artifacts WHERE namespace = ? ORDER BY id",
      )
      .all(this.namespace) as PayloadRow[];
    const utterances = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_utterances WHERE namespace = ? ORDER BY id",
      )
      .all(this.namespace) as PayloadRow[];
    const evidenceClaims = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_claims WHERE namespace = ? ORDER BY id",
      )
      .all(this.namespace) as PayloadRow[];
    const provenance = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_provenance WHERE namespace = ? ORDER BY id",
      )
      .all(this.namespace) as PayloadRow[];
    const labelRows = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_labels WHERE namespace = ? ORDER BY record_id",
      )
      .all(this.namespace) as readonly { readonly payload_json: string }[];
    const lifecycleRecords = this.database
      .prepare(
        "SELECT payload_json FROM A008_knowledge_lifecycle WHERE namespace = ? ORDER BY evidence_id",
      )
      .all(this.namespace) as PayloadRow[];
    const lifecycleTransitions = this.database
      .prepare(
        `SELECT payload_json FROM A008_knowledge_lifecycle_transitions
         WHERE namespace = ? ORDER BY seq, id`,
      )
      .all(this.namespace) as PayloadRow[];
    const relations = this.database
      .prepare(
        `SELECT from_id, to_id, relation FROM A008_knowledge_relations
         WHERE namespace = ? ORDER BY from_id, to_id, relation`,
      )
      .all(this.namespace) as RelationRow[];

    return {
      entities: entities.map((row) => parseJson<Entity>(row.payload_json, "entity")),
      slots: slots.map((row) =>
        parseJson<SlotDefinition>(row.payload_json, "slot"),
      ),
      state: {
        bindings: bindings.map((row) => restoreBinding(row)),
        claims: claims.map((row) =>
          parseJson<SlotClaim>(row.payload_json, "slot claim"),
        ),
        transitions: transitions.map((row) =>
          parseJson<StateTransition>(row.payload_json, "transition"),
        ),
        events: events.map((row) =>
          parseJson<StubEvent>(row.payload_json, "event"),
        ),
        corrections: corrections.map((row) =>
          parseJson<CorrectionRecord>(row.payload_json, "correction"),
        ),
        contestedSlotKeys: contested.map((row) => row.slot_key),
      },
      stateNextTransition: meta?.state_next_transition ?? 0,
      artifacts: artifacts.map((row) =>
        parseJson<Artifact>(row.payload_json, "artifact"),
      ),
      utterances: utterances.map((row) =>
        parseJson<Utterance>(row.payload_json, "utterance"),
      ),
      claims: evidenceClaims.map((row) =>
        parseJson<Claim>(row.payload_json, "evidence claim"),
      ),
      provenance: provenance.map((row) =>
        parseJson<ProvenanceRecord>(row.payload_json, "provenance"),
      ),
      labels: labelRows.map((row) => parseJson<LabelRecord>(row.payload_json, "labels")),
      lifecycle: {
        receipts: (this.database.prepare("SELECT payload_json FROM A008_knowledge_reinforcement_receipts WHERE namespace = ? ORDER BY occurrence_id, evidence_id").all(this.namespace) as PayloadRow[]).map(r => parseJson<ReinforcementReceipt>(r.payload_json, "reinforcement receipt")),
        records: lifecycleRecords.map((row) =>
          parseJson<LifecycleRecord>(row.payload_json, "lifecycle"),
        ),
        transitions: lifecycleTransitions.map((row) =>
          parseJson<LifecycleTransition>(row.payload_json, "lifecycle transition"),
        ),
      },
      lifecycleNextTransition: meta?.lifecycle_next_transition ?? 0,
      associations: this.loadAssociations(),
      relations: relations.map((row) => ({
        from: row.from_id,
        to: row.to_id,
        relation: row.relation,
      })),
    };
  }

  private loadAssociations(): AssociationSnapshot {
    const records = (this.database.prepare("SELECT edge_key, payload_json FROM A008_knowledge_association_lifecycle WHERE namespace = ? ORDER BY edge_key").all(this.namespace) as (PayloadRow & { edge_key: string })[]).map(row => {
      const record = parseJson<AssociationRecord>(row.payload_json, "association");
      if (record.key !== row.edge_key) throw new Error("Corrupt association storage key");
      return record;
    });
    const receipts = (this.database.prepare("SELECT occurrence_id, edge_key, payload_json FROM A008_knowledge_association_receipts WHERE namespace = ? ORDER BY occurrence_id, edge_key").all(this.namespace) as (PayloadRow & { edge_key: string; occurrence_id: string })[]).map(row => {
      const receipt = parseJson<AssociationReceipt>(row.payload_json, "association receipt");
      if (receipt.edgeKey !== row.edge_key || receipt.occurrenceId !== row.occurrence_id) throw new Error("Corrupt association receipt key");
      return receipt;
    });
    const transitions = (this.database.prepare("SELECT payload_json FROM A008_knowledge_association_transitions WHERE namespace = ? ORDER BY seq").all(this.namespace) as PayloadRow[]).map(row => parseJson<AssociationTransition>(row.payload_json, "association audit"));
    const owner = new AssociationLifecycle();
    owner.hydrate({ records, receipts, transitions });
    return owner.snapshot();
  }

  replaceNamespace(snapshot: KnowledgeNamespaceSnapshot): void {
    this.requireOpen();
    this.database.transaction(() => {
      this.clearNamespace();
      insertKnowledgeSnapshot(this.database, this.namespace, snapshot);
    })();
  }

  /** Caller captures before under atomic() after refreshing its revision. */
  updateNamespace(before: KnowledgeNamespaceSnapshot, after: KnowledgeNamespaceSnapshot): void {
    this.atomic(() => updateKnowledgeSnapshot(this.database, this.namespace, before, after));
  }

  private clearNamespace(): void {
    const tables = [
      "A008_knowledge_fts",
      "A008_knowledge_slot_index",
      "A008_knowledge_entity_labels",
      "A008_knowledge_label_index",
      "A008_knowledge_labels",
      "A008_knowledge_relations",
      "A008_knowledge_association_receipts",
      "A008_knowledge_association_transitions",
      "A008_knowledge_association_lifecycle",
      "A008_knowledge_reinforcement_receipts",
      "A008_knowledge_lifecycle_transitions",
      "A008_knowledge_lifecycle",
      "A008_knowledge_provenance",
      "A008_knowledge_claims",
      "A008_knowledge_utterances",
      "A008_knowledge_artifacts",
      "A008_knowledge_events",
      "A008_knowledge_slot_claims",
      "A008_knowledge_contested",
      "A008_knowledge_corrections",
      "A008_knowledge_transitions",
      "A008_knowledge_bindings",
      "A008_knowledge_slots",
      "A008_knowledge_entities",
      "A008_knowledge_meta",
    ];
    for (const table of tables) {
      this.database
        .prepare(`DELETE FROM ${table} WHERE namespace = ?`)
        .run(this.namespace);
    }
  }

  private v0TableExists(): boolean {
    const row = this.database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name = 'A008_memory_knowledge'`,
      )
      .get() as { readonly name: string } | undefined;
    return row !== undefined;
  }

  private loadV0Items(): readonly KnowledgeItem[] {
    const rows = this.database
      .prepare(
        `SELECT id, payload_json FROM A008_memory_knowledge
         WHERE namespace = ? ORDER BY id`,
      )
      .all(this.namespace) as KnowledgeItemRow[];
    return rows.map((row) => parseJson<KnowledgeItem>(row.payload_json, "v0 knowledge"));
  }

  /** Schema 1/2 gets L2's baseline conversion; schema 3 baselines are validated
   * unchanged. L3 adds empty metadata/receipt/audit tables, never promotes old
   * links. The constructor encloses DDL and this version update in one transaction.
   */
  private migrateSchemaVersion(): void {
    this.database.transaction(() => {
      const row = this.database.prepare("SELECT version FROM A008_knowledge_schema WHERE singleton = 1").get() as { version: number } | undefined;
      if (row?.version !== 1 && row?.version !== 2 && row?.version !== 3) return;
      const baselineAlreadyMigrated = row.version === 3;
      const at = operationalTime(this.clock());
      const records = this.database.prepare("SELECT namespace, evidence_id, payload_json FROM A008_knowledge_lifecycle").all() as { namespace: string; evidence_id: string; payload_json: string }[];
      const save = this.database.prepare("UPDATE A008_knowledge_lifecycle SET payload_json = ? WHERE namespace = ? AND evidence_id = ?");
      for (const row of records) {
        const record = parseJson<LifecycleRecord>(row.payload_json, "legacy lifecycle");
        if (record.evidenceId !== row.evidence_id) throw new KnowledgeModelError("invalid_input", "Corrupt lifecycle identity");
        if (baselineAlreadyMigrated) validateLifecycle(record.lifecycle);
        else save.run(JSON.stringify(migrateLegacyLifecycle(record, at)), row.namespace, row.evidence_id);
      }
      this.database.prepare("UPDATE A008_knowledge_schema SET version = ? WHERE singleton = 1").run(KNOWLEDGE_SQLITE_SCHEMA_VERSION);
    }).immediate();
  }

  private assertSchemaVersion(): void {
    const row = this.database
      .prepare("SELECT version FROM A008_knowledge_schema WHERE singleton = 1")
      .get() as { readonly version: number } | undefined;
    if (row === undefined ) {
      throw new KnowledgeModelError(
        "invalid_input",
        "knowledge SQLite schema version mismatch",
      );
    }
  }

  private requireOpen(): void {
    if (this.closed) {
      throw new KnowledgeModelError(
        "invalid_input",
        "knowledge SQLite store is closed",
      );
    }
  }
}

function restoreBinding(row: BindingRow): Binding {
  const binding = parseJson<Binding>(row.payload_json, "binding");
  const interval = intervalFromColumns(row.valid_from, row.valid_to);
  return {
    ...binding,
    interval,
  };
}

function migrateV0Items(
  items: readonly KnowledgeItem[],
  existing: KnowledgeNamespaceSnapshot,
): {
  readonly snapshot: KnowledgeNamespaceSnapshot;
  readonly chainsMigrated: number;
} {
  if (items.length === 0) {
    return { snapshot: existing, chainsMigrated: 0 };
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const successors = new Set(
    items
      .map((item) => item.supersededBy)
      .filter((id): id is string => id !== null),
  );
  const roots = items.filter((item) => !successors.has(item.id));
  const entities = [...existing.entities];
  const slots = [...existing.slots];
  const bindings = [...existing.state.bindings];
  const slotClaims = [...existing.state.claims];
  const artifacts = [...existing.artifacts];
  const utterances = [...existing.utterances];
  const claims = [...existing.claims];
  const provenance = [...existing.provenance];
  const lifecycleRecords = [...existing.lifecycle.records];
  const lifecycleTransitions = [...existing.lifecycle.transitions];
  let chainsMigrated = 0;
  let lifeSeq = existing.lifecycleNextTransition;

  for (const root of roots) {
    const chain = walkChain(root, byId);
    if (chain.length === 0) {
      continue;
    }
    chainsMigrated += 1;
    const entityId = asEntityId(`migrated_${root.id}`);
    const labels = uniqueLabels(chain);
    entities.push({
      id: entityId,
      type: chain[0]?.kind ?? "fact",
      labels,
    });
    const slot: SlotDefinition = {
      ref: { kind: "attribute", entity: entityId, name: "statement" },
      cardinality: "single",
      valueType: "string",
    };
    slots.push(slot);
    chain.forEach((item, index) => {
      const isLast = index === chain.length - 1;
      const isCurrent = isLast && item.canonicalStatus === "current";
      const interval: Interval = {
        from: UNKNOWN_INSTANT,
        to: isCurrent ? null : UNKNOWN_INSTANT,
      };
      const claimId = `migrated_claim_${item.id}`;
      slotClaims.push({
        id: claimId,
        slot: slot.ref,
        value: item.proposition,
        label: item.proposition,
        aboutInterval: interval,
        status: isCurrent ? "accepted" : "retracted",
        attributedTo: "migrated",
        causedBy: `migrated:${item.id}`,
        kind: "assertion",
        acceptanceEligible: true,
      });
      bindings.push({
        kind: "attribute",
        slot: {
          kind: "attribute",
          entity: entityId,
          name: "statement",
        },
        value: item.proposition,
        label: item.proposition,
        interval,
        causedBy: `migrated:${item.id}`,
        claimId,
      });
      const artifactId = asArtifactId(`migrated_artifact_${item.id}`);
      artifacts.push({
        id: artifactId,
        contentKind: "dialogue_assertion",
        locator: `migrated:${item.id}`,
        ingestedAt: UNKNOWN_INSTANT,
      });
      const utteranceId = `migrated_utterance_${item.id}`;
      utterances.push({
        id: utteranceId as Utterance["id"],
        speaker: "migrated",
        act: "assertion",
        contentKind: "dialogue_assertion",
        content: item.proposition,
        assertedAt: UNKNOWN_INSTANT,
        ingestedAt: UNKNOWN_INSTANT,
        artifactId,
      });
      claims.push({
        id: `migrated_evidence_${item.id}` as Claim["id"],
        label: item.proposition,
        proposition: {
          kind: "attribute_binding",
          entityLabel: String(entityId),
          attribute: "statement",
          value: item.proposition,
        },
        certainty: "certain",
        attributedTo: "migrated",
        derivedFrom: { kind: "utterance", id: utteranceId },
        aboutInterval: interval,
        status: isCurrent ? "accepted" : "asserted",
      });
      provenance.push({
        id: `migrated_provenance_${item.id}` as ProvenanceRecord["id"],
        relation: "appears_in",
        fromKind: "utterance",
        fromId: utteranceId,
        fromLabel: item.proposition,
        toKind: "artifact",
        toId: artifactId,
        toLabel: artifactId,
      });
      lifeSeq += 1;
      const strength =
        item.activationStatus === "active"
          ? Math.max(item.relevanceScore, item.activationThreshold)
          : Math.min(item.relevanceScore, Math.max(0, item.activationThreshold - 0.01));
      const state = item.activationStatus === "active" ? "active" : "dormant";
      lifecycleRecords.push({
        evidenceId: utteranceId,
        evidenceKind: "utterance",
        lifecycle: {
          state,
          strength,
          decayRate: 0.1,
          threshold: item.activationThreshold,
          pinned: item.keepAlive,
          lastReinforcedAt: UNKNOWN_INSTANT,
        } as LifecycleRecord["lifecycle"],
      });
      lifecycleTransitions.push({
        id: `A008_knowledge_lifecycle_${String(lifeSeq).padStart(4, "0")}`,
        evidenceId: utteranceId,
        kind: "created",
        fromStrength: strength,
        toStrength: strength,
        fromState: state,
        toState: state,
        at: UNKNOWN_INSTANT,
        caller: "migrate-v0",
        reason: "v0 supersede chain migrated with unknown interval boundaries",
      });
    });
  }

  return {
    chainsMigrated,
    snapshot: {
      ...existing,
      entities,
      slots,
      artifacts,
      utterances,
      claims,
      provenance,
      relations: existing.relations,
      ...(existing.associations === undefined ? {} : { associations: existing.associations }),
      state: {
        ...existing.state,
        bindings,
        claims: slotClaims,
      },
      lifecycle: {
        records: lifecycleRecords,
        transitions: lifecycleTransitions,
      },
      lifecycleNextTransition: lifeSeq,
    },
  };
}

function walkChain(
  root: KnowledgeItem,
  byId: ReadonlyMap<string, KnowledgeItem>,
): KnowledgeItem[] {
  const chain: KnowledgeItem[] = [];
  const visited = new Set<string>();
  let current: KnowledgeItem | undefined = root;
  while (current !== undefined) {
    if (visited.has(current.id)) {
      break;
    }
    visited.add(current.id);
    chain.push(current);
    const nextId: string | null = current.supersededBy;
    const next: KnowledgeItem | undefined =
      nextId === null ? undefined : byId.get(nextId);
    current = next;
  }
  return chain;
}

function uniqueLabels(chain: readonly KnowledgeItem[]): string[] {
  const labels = new Set<string>();
  for (const item of chain) {
    labels.add(item.proposition);
    for (const tag of item.tags) {
      labels.add(tag);
    }
    for (const token of item.proposition
      .trim()
      .toLocaleLowerCase("und")
      .split(/[^a-z0-9åäö]+/u)
      .filter((part) => part.length >= 4)) {
      labels.add(token);
    }
  }
  return [...labels];
}
