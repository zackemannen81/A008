import Database from "better-sqlite3";
import type { Database as BetterSqliteDatabase } from "better-sqlite3";
import { parseRuntimeId } from "../../identity/runtime-id.js";
import type { ProjectId } from "../../identity/types.js";
import type { KnowledgeItem } from "../types.js";
import {
  deserializeInstant,
  serializeInstant,
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
import { slotKey } from "./registry.js";
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
  readonly filename: string;
  readonly projectId: ProjectId;
  readonly database?: BetterSqliteDatabase;
}

export interface KnowledgeNamespaceSnapshot {
  readonly entities: readonly Entity[];
  readonly slots: readonly SlotDefinition[];
  readonly state: KnowledgeStateSnapshot;
  readonly stateNextTransition: number;
  readonly artifacts: readonly Artifact[];
  readonly utterances: readonly Utterance[];
  readonly claims: readonly Claim[];
  readonly provenance: readonly ProvenanceRecord[];
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

function instantColumn(instant: Instant): string {
  return serializeInstant(instant);
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

  constructor(options: SqliteKnowledgeStoreOptions) {
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
      this.database.exec(KNOWLEDGE_SQLITE_SCHEMA);
      this.assertSchemaVersion();
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
    this.replaceNamespace(migrated.snapshot);
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
      lifecycle: {
        records: lifecycleRecords.map((row) =>
          parseJson<LifecycleRecord>(row.payload_json, "lifecycle"),
        ),
        transitions: lifecycleTransitions.map((row) =>
          parseJson<LifecycleTransition>(row.payload_json, "lifecycle transition"),
        ),
      },
      lifecycleNextTransition: meta?.lifecycle_next_transition ?? 0,
      relations: relations.map((row) => ({
        from: row.from_id,
        to: row.to_id,
        relation: row.relation,
      })),
    };
  }

  replaceNamespace(snapshot: KnowledgeNamespaceSnapshot): void {
    this.requireOpen();
    const persist = this.database.transaction(() => {
      this.clearNamespace();
      this.database
        .prepare(
          `INSERT INTO A008_knowledge_meta(
             namespace, state_next_transition, lifecycle_next_transition
           ) VALUES (?, ?, ?)`,
        )
        .run(
          this.namespace,
          snapshot.stateNextTransition,
          snapshot.lifecycleNextTransition,
        );
      const insertEntity = this.database.prepare(
        `INSERT INTO A008_knowledge_entities(
           namespace, id, type, labels_json, payload_json
         ) VALUES (?, ?, ?, ?, ?)`,
      );
      const insertLabel = this.database.prepare(
        `INSERT INTO A008_knowledge_entity_labels(namespace, entity_id, label)
         VALUES (?, ?, ?)`,
      );
      for (const entity of snapshot.entities) {
        insertEntity.run(
          this.namespace,
          entity.id,
          entity.type,
          JSON.stringify(entity.labels),
          JSON.stringify(entity),
        );
        for (const label of entity.labels) {
          insertLabel.run(this.namespace, entity.id, label);
        }
      }
      const insertSlot = this.database.prepare(
        `INSERT INTO A008_knowledge_slots(
           namespace, slot_key, kind, cardinality, value_type, ref_json, payload_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const slot of snapshot.slots) {
        insertSlot.run(
          this.namespace,
          slotKey(slot.ref),
          slot.ref.kind,
          slot.cardinality,
          slot.valueType,
          JSON.stringify(slot.ref),
          JSON.stringify(slot),
        );
      }
      const insertBinding = this.database.prepare(
        `INSERT INTO A008_knowledge_bindings(
           namespace, slot_key, claim_id, kind, label, value_json, object_id,
           valid_from, valid_to, caused_by, payload_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertSlotIndex = this.database.prepare(
        `INSERT INTO A008_knowledge_slot_index(
           namespace, slot_key, claim_id, valid_from, is_open
         ) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const binding of snapshot.state.bindings) {
        const from = instantColumn(binding.interval.from);
        const to =
          binding.interval.to === null
            ? null
            : instantColumn(binding.interval.to);
        const key = slotKey(binding.slot);
        const value =
          binding.kind === "attribute" ? binding.value : binding.object;
        insertBinding.run(
          this.namespace,
          key,
          binding.claimId,
          binding.kind,
          binding.label,
          JSON.stringify(value),
          binding.kind === "relationship" ? String(binding.object) : null,
          from,
          to,
          binding.causedBy,
          JSON.stringify(binding),
        );
        insertSlotIndex.run(
          this.namespace,
          key,
          binding.claimId,
          from,
          to === null ? 1 : 0,
        );
      }
      const insertTransition = this.database.prepare(
        `INSERT INTO A008_knowledge_transitions(
           namespace, id, slot_key, seq, at_json, payload_json
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      snapshot.state.transitions.forEach((transition, index) => {
        insertTransition.run(
          this.namespace,
          transition.id,
          slotKey(transition.slot),
          index + 1,
          instantColumn(transition.at),
          JSON.stringify(transition),
        );
      });
      const insertCorrection = this.database.prepare(
        `INSERT INTO A008_knowledge_corrections(
           namespace, transition_id, slot_key, payload_json
         ) VALUES (?, ?, ?, ?)`,
      );
      for (const correction of snapshot.state.corrections) {
        insertCorrection.run(
          this.namespace,
          correction.transitionId,
          slotKey(correction.slot),
          JSON.stringify(correction),
        );
      }
      const insertContested = this.database.prepare(
        "INSERT INTO A008_knowledge_contested(namespace, slot_key) VALUES (?, ?)",
      );
      for (const key of snapshot.state.contestedSlotKeys) {
        insertContested.run(this.namespace, key);
      }
      const insertSlotClaim = this.database.prepare(
        `INSERT INTO A008_knowledge_slot_claims(
           namespace, id, slot_key, payload_json
         ) VALUES (?, ?, ?, ?)`,
      );
      for (const claim of snapshot.state.claims) {
        insertSlotClaim.run(
          this.namespace,
          claim.id,
          slotKey(claim.slot),
          JSON.stringify(claim),
        );
      }
      const insertEvent = this.database.prepare(
        "INSERT INTO A008_knowledge_events(namespace, id, payload_json) VALUES (?, ?, ?)",
      );
      for (const event of snapshot.state.events) {
        insertEvent.run(this.namespace, event.id, JSON.stringify(event));
      }
      const insertArtifact = this.database.prepare(
        `INSERT INTO A008_knowledge_artifacts(
           namespace, id, content_kind, locator, ingested_at, payload_json
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      for (const artifact of snapshot.artifacts) {
        insertArtifact.run(
          this.namespace,
          artifact.id,
          artifact.contentKind,
          artifact.locator,
          instantColumn(artifact.ingestedAt),
          JSON.stringify(artifact),
        );
      }
      const insertUtterance = this.database.prepare(
        `INSERT INTO A008_knowledge_utterances(
           namespace, id, speaker, act, payload_json
         ) VALUES (?, ?, ?, ?, ?)`,
      );
      for (const utterance of snapshot.utterances) {
        insertUtterance.run(
          this.namespace,
          utterance.id,
          utterance.speaker,
          utterance.act,
          JSON.stringify(utterance),
        );
      }
      const insertClaim = this.database.prepare(
        `INSERT INTO A008_knowledge_claims(
           namespace, id, status, payload_json
         ) VALUES (?, ?, ?, ?)`,
      );
      for (const claim of snapshot.claims) {
        insertClaim.run(
          this.namespace,
          claim.id,
          claim.status,
          JSON.stringify(claim),
        );
      }
      const insertProvenance = this.database.prepare(
        `INSERT INTO A008_knowledge_provenance(
           namespace, id, payload_json
         ) VALUES (?, ?, ?)`,
      );
      for (const record of snapshot.provenance) {
        insertProvenance.run(this.namespace, record.id, JSON.stringify(record));
      }
      const insertLifecycle = this.database.prepare(
        `INSERT INTO A008_knowledge_lifecycle(
           namespace, evidence_id, evidence_kind, payload_json
         ) VALUES (?, ?, ?, ?)`,
      );
      for (const record of snapshot.lifecycle.records) {
        insertLifecycle.run(
          this.namespace,
          record.evidenceId,
          record.evidenceKind,
          JSON.stringify(record),
        );
      }
      const insertLifeTransition = this.database.prepare(
        `INSERT INTO A008_knowledge_lifecycle_transitions(
           namespace, id, evidence_id, seq, payload_json
         ) VALUES (?, ?, ?, ?, ?)`,
      );
      snapshot.lifecycle.transitions.forEach((transition, index) => {
        insertLifeTransition.run(
          this.namespace,
          transition.id,
          transition.evidenceId,
          index + 1,
          JSON.stringify(transition),
        );
      });
      const insertRelation = this.database.prepare(
        `INSERT INTO A008_knowledge_relations(
           namespace, from_id, to_id, relation
         ) VALUES (?, ?, ?, ?)`,
      );
      for (const link of snapshot.relations) {
        insertRelation.run(
          this.namespace,
          link.from,
          link.to,
          link.relation,
        );
      }
      this.rebuildFts(snapshot);
    });
    persist();
  }

  private rebuildFts(snapshot: KnowledgeNamespaceSnapshot): void {
    this.database
      .prepare("DELETE FROM A008_knowledge_fts WHERE namespace = ?")
      .run(this.namespace);
    const insert = this.database.prepare(
      `INSERT INTO A008_knowledge_fts(namespace, record_kind, record_id, labels)
       VALUES (?, ?, ?, ?)`,
    );
    for (const entity of snapshot.entities) {
      insert.run(
        this.namespace,
        "entity",
        entity.id,
        entity.labels.join(" "),
      );
    }
    for (const slot of snapshot.slots) {
      const name = slot.ref.kind === "attribute" ? slot.ref.name : slot.ref.name;
      insert.run(this.namespace, "slot", slotKey(slot.ref), name);
    }
    for (const binding of snapshot.state.bindings) {
      insert.run(
        this.namespace,
        "binding",
        `${slotKey(binding.slot)}:${binding.claimId}`,
        binding.label,
      );
    }
    for (const utterance of snapshot.utterances) {
      insert.run(this.namespace, "utterance", utterance.id, utterance.content);
    }
    for (const claim of snapshot.claims) {
      insert.run(this.namespace, "claim", claim.id, claim.label);
    }
    for (const event of snapshot.state.events) {
      insert.run(this.namespace, "event", event.id, event.label);
    }
  }

  private clearNamespace(): void {
    const tables = [
      "A008_knowledge_fts",
      "A008_knowledge_slot_index",
      "A008_knowledge_entity_labels",
      "A008_knowledge_relations",
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

  private assertSchemaVersion(): void {
    const row = this.database
      .prepare("SELECT version FROM A008_knowledge_schema WHERE singleton = 1")
      .get() as { readonly version: number } | undefined;
    if (row === undefined || row.version !== KNOWLEDGE_SQLITE_SCHEMA_VERSION) {
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
        },
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
