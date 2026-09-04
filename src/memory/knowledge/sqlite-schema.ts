export const KNOWLEDGE_SQLITE_SCHEMA_VERSION = 2;

export const KNOWLEDGE_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS A008_knowledge_schema (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  version INTEGER NOT NULL
);
INSERT OR IGNORE INTO A008_knowledge_schema(singleton, version)
  VALUES (1, ${KNOWLEDGE_SQLITE_SCHEMA_VERSION});

CREATE TABLE IF NOT EXISTS A008_knowledge_migration (
  namespace TEXT PRIMARY KEY,
  from_schema TEXT NOT NULL,
  status TEXT NOT NULL,
  chains_migrated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS A008_knowledge_meta (
  namespace TEXT PRIMARY KEY,
  state_next_transition INTEGER NOT NULL,
  lifecycle_next_transition INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS A008_knowledge_artifacts (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  content_kind TEXT NOT NULL,
  locator TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_entities (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  labels_json TEXT NOT NULL CHECK (json_valid(labels_json)),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_entity_labels (
  namespace TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY(namespace, entity_id, label),
  FOREIGN KEY(namespace, entity_id)
    REFERENCES A008_knowledge_entities(namespace, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS A008_knowledge_entity_labels_label_idx
  ON A008_knowledge_entity_labels(namespace, label, entity_id);

CREATE TABLE IF NOT EXISTS A008_knowledge_slots (
  namespace TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  cardinality TEXT NOT NULL,
  value_type TEXT NOT NULL,
  ref_json TEXT NOT NULL CHECK (json_valid(ref_json)),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, slot_key)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_bindings (
  namespace TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  object_id TEXT,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  caused_by TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, slot_key, claim_id, valid_from)
);
CREATE INDEX IF NOT EXISTS A008_knowledge_bindings_slot_idx
  ON A008_knowledge_bindings(namespace, slot_key, valid_to);

CREATE TABLE IF NOT EXISTS A008_knowledge_slot_index (
  namespace TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  is_open INTEGER NOT NULL CHECK (is_open IN (0, 1)),
  PRIMARY KEY(namespace, slot_key, claim_id, valid_from)
);
CREATE INDEX IF NOT EXISTS A008_knowledge_slot_index_open_idx
  ON A008_knowledge_slot_index(namespace, slot_key, is_open);

CREATE TABLE IF NOT EXISTS A008_knowledge_transitions (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  seq INTEGER NOT NULL,
  at_json TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);
CREATE INDEX IF NOT EXISTS A008_knowledge_transitions_slot_idx
  ON A008_knowledge_transitions(namespace, slot_key, seq);

CREATE TABLE IF NOT EXISTS A008_knowledge_corrections (
  namespace TEXT NOT NULL,
  transition_id TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, transition_id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_contested (
  namespace TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  PRIMARY KEY(namespace, slot_key)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_slot_claims (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);
CREATE INDEX IF NOT EXISTS A008_knowledge_slot_claims_slot_idx
  ON A008_knowledge_slot_claims(namespace, slot_key);

CREATE TABLE IF NOT EXISTS A008_knowledge_events (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_utterances (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  speaker TEXT NOT NULL,
  act TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_claims (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_provenance (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_lifecycle (
  namespace TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  evidence_kind TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, evidence_id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_lifecycle_transitions (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_labels (
  namespace TEXT NOT NULL,
  record_id TEXT NOT NULL,
  record_kind TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  PRIMARY KEY(namespace, record_id)
);

CREATE TABLE IF NOT EXISTS A008_knowledge_label_index (
  namespace TEXT NOT NULL,
  record_id TEXT NOT NULL,
  axis TEXT NOT NULL CHECK (axis IN ('tag', 'domain')),
  value TEXT NOT NULL,
  PRIMARY KEY(namespace, record_id, axis, value)
);

CREATE INDEX IF NOT EXISTS A008_knowledge_label_index_lookup
  ON A008_knowledge_label_index(namespace, axis, value);

CREATE TABLE IF NOT EXISTS A008_knowledge_relations (
  namespace TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  PRIMARY KEY(namespace, from_id, to_id, relation)
);

CREATE VIRTUAL TABLE IF NOT EXISTS A008_knowledge_fts USING fts5(
  namespace UNINDEXED,
  record_kind UNINDEXED,
  record_id UNINDEXED,
  labels
);
`;
