import type { Database as BetterSqliteDatabase, Statement } from "better-sqlite3";
import { AssociationLifecycle, EMPTY_ASSOCIATIONS } from "./association-lifecycle.js";
import { serializeInstant } from "./clocks.js";
import { slotKey } from "./registry.js";
import type { KnowledgeNamespaceSnapshot } from "./sqlite-store.js";

type Value = string | number | null;
type Row = readonly Value[];
interface TableRows {
  readonly name: string;
  readonly columns: readonly string[];
  readonly keys: readonly string[];
  readonly rows: Row[];
  readonly ignoreDuplicates: boolean;
}

// One serialization for bulk migration and ordinary incremental writes. Table
// and column identifiers below are code-owned, never input or persisted text.
function projectSnapshot(namespace: string, snapshot: KnowledgeNamespaceSnapshot): TableRows[] {
  const tables: TableRows[] = [];
  const table = (name: string, columns: string[], keys: string[], ignoreDuplicates = false) => {
    const rows: Row[] = [];
    tables.push({ name, columns, keys, rows, ignoreDuplicates });
    return { add: (...values: Value[]) => { rows.push(values); } };
  };
  table("A008_knowledge_meta", ["namespace", "state_next_transition", "lifecycle_next_transition"], ["namespace"])
    .add(
      namespace,
      snapshot.stateNextTransition,
      snapshot.lifecycleNextTransition,
    );
  const insertEntity = table("A008_knowledge_entities", ["namespace", "id", "type", "labels_json", "payload_json"], ["namespace", "id"]);
  const insertLabel = table("A008_knowledge_entity_labels", ["namespace", "entity_id", "label"], ["namespace", "entity_id", "label"]);
  for (const entity of snapshot.entities) {
    insertEntity.add(
      namespace,
      entity.id,
      entity.type,
      JSON.stringify(entity.labels),
      JSON.stringify(entity),
    );
    for (const label of entity.labels) {
      insertLabel.add(namespace, entity.id, label);
    }
  }
  const insertSlot = table("A008_knowledge_slots", ["namespace", "slot_key", "kind", "cardinality", "value_type", "ref_json", "payload_json"], ["namespace", "slot_key"]);
  for (const slot of snapshot.slots) {
    insertSlot.add(
      namespace,
      slotKey(slot.ref),
      slot.ref.kind,
      slot.cardinality,
      slot.valueType,
      JSON.stringify(slot.ref),
      JSON.stringify(slot),
    );
  }
  const insertBinding = table("A008_knowledge_bindings", ["namespace", "slot_key", "claim_id", "kind", "label", "value_json", "object_id", "valid_from", "valid_to", "caused_by", "payload_json"], ["namespace", "slot_key", "claim_id", "valid_from"]);
  const insertSlotIndex = table("A008_knowledge_slot_index", ["namespace", "slot_key", "claim_id", "valid_from", "is_open"], ["namespace", "slot_key", "claim_id", "valid_from"]);
  for (const binding of snapshot.state.bindings) {
    const from = serializeInstant(binding.interval.from);
    const to =
      binding.interval.to === null
        ? null
        : serializeInstant(binding.interval.to);
    const key = slotKey(binding.slot);
    const value =
      binding.kind === "attribute" ? binding.value : binding.object;
    insertBinding.add(
      namespace,
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
    insertSlotIndex.add(
      namespace,
      key,
      binding.claimId,
      from,
      to === null ? 1 : 0,
    );
  }
  const insertTransition = table("A008_knowledge_transitions", ["namespace", "id", "slot_key", "seq", "at_json", "payload_json"], ["namespace", "id"]);
  snapshot.state.transitions.forEach((transition, index) => {
    insertTransition.add(
      namespace,
      transition.id,
      slotKey(transition.slot),
      index + 1,
      serializeInstant(transition.at),
      JSON.stringify(transition),
    );
  });
  const insertCorrection = table("A008_knowledge_corrections", ["namespace", "transition_id", "slot_key", "payload_json"], ["namespace", "transition_id"]);
  for (const correction of snapshot.state.corrections) {
    insertCorrection.add(
      namespace,
      correction.transitionId,
      slotKey(correction.slot),
      JSON.stringify(correction),
    );
  }
  const insertContested = table("A008_knowledge_contested", ["namespace", "slot_key"], ["namespace", "slot_key"]);
  for (const key of snapshot.state.contestedSlotKeys) {
    insertContested.add(namespace, key);
  }
  const insertSlotClaim = table("A008_knowledge_slot_claims", ["namespace", "id", "slot_key", "payload_json"], ["namespace", "id"]);
  for (const claim of snapshot.state.claims) {
    insertSlotClaim.add(
      namespace,
      claim.id,
      slotKey(claim.slot),
      JSON.stringify(claim),
    );
  }
  const insertEvent = table("A008_knowledge_events", ["namespace", "id", "payload_json"], ["namespace", "id"]);
  for (const event of snapshot.state.events) {
    insertEvent.add(namespace, event.id, JSON.stringify(event));
  }
  const insertArtifact = table("A008_knowledge_artifacts", ["namespace", "id", "content_kind", "locator", "ingested_at", "payload_json"], ["namespace", "id"]);
  for (const artifact of snapshot.artifacts) {
    insertArtifact.add(
      namespace,
      artifact.id,
      artifact.contentKind,
      artifact.locator,
      serializeInstant(artifact.ingestedAt),
      JSON.stringify(artifact),
    );
  }
  const insertUtterance = table("A008_knowledge_utterances", ["namespace", "id", "speaker", "act", "payload_json"], ["namespace", "id"]);
  for (const utterance of snapshot.utterances) {
    insertUtterance.add(
      namespace,
      utterance.id,
      utterance.speaker,
      utterance.act,
      JSON.stringify(utterance),
    );
  }
  const insertClaim = table("A008_knowledge_claims", ["namespace", "id", "status", "payload_json"], ["namespace", "id"]);
  for (const claim of snapshot.claims) {
    insertClaim.add(
      namespace,
      claim.id,
      claim.status,
      JSON.stringify(claim),
    );
  }
  const insertClaimEntity = table("A008_knowledge_claim_entities", ["namespace", "claim_id", "entity_id"], ["namespace", "claim_id", "entity_id"]);
  for (const reference of snapshot.entityReferences ?? []) {
    insertClaimEntity.add(namespace, reference.claimId, reference.entityId);
  }
  const insertProvenance = table("A008_knowledge_provenance", ["namespace", "id", "payload_json"], ["namespace", "id"]);
  for (const record of snapshot.provenance) {
    insertProvenance.add(namespace, record.id, JSON.stringify(record));
  }
  const insertLabels = table("A008_knowledge_labels", ["namespace", "record_id", "record_kind", "payload_json"], ["namespace", "record_id"]);
  const insertLabelIndex = table("A008_knowledge_label_index", ["namespace", "record_id", "axis", "value"], ["namespace", "record_id", "axis", "value"], true);
  for (const record of snapshot.labels) {
    insertLabels.add(
      namespace,
      record.recordId,
      record.recordKind,
      JSON.stringify(record),
    );
    // The payload is the record; the index is what a lookup reads. Both are
    // written from the same normalised values so they cannot disagree.
    for (const tag of record.tags) {
      insertLabelIndex.add(namespace, record.recordId, "tag", tag);
    }
    for (const domain of record.domains) {
      insertLabelIndex.add(namespace, record.recordId, "domain", domain);
    }
  }
  const insertLifecycle = table("A008_knowledge_lifecycle", ["namespace", "evidence_id", "evidence_kind", "payload_json"], ["namespace", "evidence_id"]);
  const insertReceipt = table("A008_knowledge_reinforcement_receipts", ["namespace", "occurrence_id", "evidence_id", "payload_json"], ["namespace", "occurrence_id", "evidence_id"]);
  for (const receipt of snapshot.lifecycle.receipts ?? []) insertReceipt.add(namespace, receipt.occurrenceId, receipt.evidenceId, JSON.stringify(receipt));
  for (const record of snapshot.lifecycle.records) {
    insertLifecycle.add(
      namespace,
      record.evidenceId,
      record.evidenceKind,
      JSON.stringify(record),
    );
  }
  const insertLifeTransition = table("A008_knowledge_lifecycle_transitions", ["namespace", "id", "evidence_id", "seq", "payload_json"], ["namespace", "id"]);
  snapshot.lifecycle.transitions.forEach((transition, index) => {
    insertLifeTransition.add(
      namespace,
      transition.id,
      transition.evidenceId,
      index + 1,
      JSON.stringify(transition),
    );
  });
  const insertRelation = table("A008_knowledge_relations", ["namespace", "from_id", "to_id", "relation"], ["namespace", "from_id", "to_id", "relation"]);
  for (const link of snapshot.relations) {
    insertRelation.add(
      namespace,
      link.from,
      link.to,
      link.relation,
    );
  }
  const associations = snapshot.associations ?? EMPTY_ASSOCIATIONS;
  new AssociationLifecycle().hydrate(associations);
  const insertAssociation = table("A008_knowledge_association_lifecycle", ["namespace", "edge_key", "payload_json"], ["namespace", "edge_key"]);
  for (const record of associations.records) insertAssociation.add(namespace, record.key, JSON.stringify(record));
  const insertAssociationReceipt = table("A008_knowledge_association_receipts", ["namespace", "occurrence_id", "edge_key", "payload_json"], ["namespace", "occurrence_id", "edge_key"]);
  for (const receipt of associations.receipts) insertAssociationReceipt.add(namespace, receipt.occurrenceId, receipt.edgeKey, JSON.stringify(receipt));
  const insertAudit = table("A008_knowledge_association_transitions", ["namespace", "seq", "payload_json"], ["namespace", "seq"]);
  associations.transitions.forEach((transition, index) => insertAudit.add(namespace, index + 1, JSON.stringify(transition)));

  const insert = table("A008_knowledge_fts", ["namespace", "record_kind", "record_id", "labels"], ["namespace", "record_kind", "record_id"]);
  for (const entity of snapshot.entities) {
    insert.add(
      namespace,
      "entity",
      entity.id,
      entity.labels.join(" "),
    );
  }
  for (const slot of snapshot.slots) {
    insert.add(namespace, "slot", slotKey(slot.ref), slot.ref.name);
  }
  for (const binding of snapshot.state.bindings) {
    insert.add(
      namespace,
      "binding",
      `${slotKey(binding.slot)}:${binding.claimId}`,
      binding.label,
    );
  }
  for (const utterance of snapshot.utterances) {
    insert.add(namespace, "utterance", utterance.id, utterance.content);
  }
  for (const claim of snapshot.claims) {
    insert.add(namespace, "claim", claim.id, claim.label);
  }
  for (const event of snapshot.state.events) {
    insert.add(namespace, "event", event.id, event.label);
  }
  return tables;
}

function insertSql(table: TableRows): string {
  return `INSERT ${table.ignoreDuplicates ? "OR IGNORE " : ""}INTO ${table.name}(${table.columns.join(", ")}) VALUES (${table.columns.map(() => "?").join(", ")})`;
}

export function insertKnowledgeSnapshot(database: BetterSqliteDatabase, namespace: string, snapshot: KnowledgeNamespaceSnapshot): void {
  for (const table of projectSnapshot(namespace, snapshot)) {
    if (table.rows.length === 0) continue;
    const insert = database.prepare(insertSql(table));
    for (const row of table.rows) insert.run(...row);
  }
}

function groups(table: TableRows): Map<string, Row[]> {
  const indexes = table.keys.map(key => table.columns.indexOf(key));
  const result = new Map<string, Row[]>();
  for (const row of table.rows) {
    const key = JSON.stringify(indexes.map(index => row[index]));
    const found = result.get(key);
    if (found) {
      if (!table.ignoreDuplicates) found.push(row);
    } else result.set(key, [row]);
  }
  return result;
}

function sameRows(left: Row[], right: Row[]): boolean {
  if (left.length !== right.length) return false;
  if (left.length === 1) return left[0]!.every((value, i) => value === right[0]![i]);
  const canonical = (rows: Row[]) => rows.map(row => JSON.stringify(row)).sort();
  const sortedRight = canonical(right);
  return canonical(left).every((row, i) => row === sortedRight[i]);
}

export function updateKnowledgeSnapshot(database: BetterSqliteDatabase, namespace: string, before: KnowledgeNamespaceSnapshot, after: KnowledgeNamespaceSnapshot): void {
  const previous = projectSnapshot(namespace, before);
  const next = projectSnapshot(namespace, after);
  const deltas = next.map((table, i) => ({ table, oldRows: groups(previous[i]!), newRows: groups(table) }));
  // Child removals precede parent removals (entity labels have a foreign key).
  for (let i = next.length - 1; i >= 0; i--) {
    const { table, oldRows, newRows } = deltas[i]!;
    const where = table.keys.map(key => `${key} = ?`).join(" AND ");
    let remove: Statement<Value[]> | undefined;
    for (const [key, rows] of oldRows) {
      if (newRows.has(key)) continue;
      remove ??= database.prepare(`DELETE FROM ${table.name} WHERE ${where}`);
      remove.run(...table.keys.map(column => rows[0]![table.columns.indexOf(column)]!));
    }
  }
  // Parents are inserted before children. Unchanged rows never execute SQL.
  for (let i = 0; i < next.length; i++) {
    const { table, oldRows, newRows } = deltas[i]!;
    const mutable = table.columns.filter(column => !table.keys.includes(column));
    const fts = table.name === "A008_knowledge_fts";
    const upsert = fts ? insertSql(table) : `${insertSql(table)} ON CONFLICT(${table.keys.join(", ")}) DO ${mutable.length ? `UPDATE SET ${mutable.map(column => `${column} = excluded.${column}`).join(", ")}` : "NOTHING"}`;
    let write: Statement<Value[]> | undefined;
    for (const [key, rows] of newRows) {
      const old = oldRows.get(key);
      // FTS may contain several historical bindings with the same record ID;
      // preserve the multiset while ignoring order-only snapshot differences.
      if (old && sameRows(old, rows)) continue;
      if (!fts && rows.length !== 1) throw new Error(`Duplicate knowledge key in ${table.name}`);
      if (fts && old) {
        const where = table.keys.map(column => `${column} = ?`).join(" AND ");
        database.prepare(`DELETE FROM ${table.name} WHERE ${where}`).run(...table.keys.map(column => rows[0]![table.columns.indexOf(column)]));
      }
      write ??= database.prepare(upsert);
      for (const row of rows) write.run(...row);
    }
  }
}
