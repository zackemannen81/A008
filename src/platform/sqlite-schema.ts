export const PLATFORM_SQLITE_SCHEMA_VERSION = 5;

export const SESSION_PROCESS_SCHEMA = `
CREATE TABLE IF NOT EXISTS A008_session_instances (
  session_id TEXT PRIMARY KEY REFERENCES A008_platform_conversations(id),
  identity_json TEXT NOT NULL CHECK(json_valid(identity_json))
);
CREATE TABLE IF NOT EXISTS A008_session_activity (
  cursor INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES A008_platform_runs(id) ON DELETE CASCADE,
  activity_json TEXT NOT NULL CHECK(json_valid(activity_json))
);
CREATE INDEX IF NOT EXISTS A008_session_activity_run ON A008_session_activity(run_id, cursor);
CREATE TABLE IF NOT EXISTS A008_session_activity_current (
  run_id TEXT PRIMARY KEY REFERENCES A008_platform_runs(id) ON DELETE CASCADE,
  cursor INTEGER NOT NULL,
  activity_json TEXT NOT NULL CHECK(json_valid(activity_json))
);
CREATE TABLE IF NOT EXISTS A008_session_config (
  session_id TEXT PRIMARY KEY REFERENCES A008_platform_conversations(id),
  model TEXT NOT NULL,
  parameters_json TEXT CHECK(parameters_json IS NULL OR json_valid(parameters_json))
);
CREATE TABLE IF NOT EXISTS A008_run_input (
  run_id TEXT PRIMARY KEY REFERENCES A008_platform_runs(id),
  attachment_json TEXT CHECK(attachment_json IS NULL OR json_valid(attachment_json))
);
CREATE TABLE IF NOT EXISTS A008_run_continuation_sources (
  run_id TEXT NOT NULL REFERENCES A008_platform_runs(id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  runtime_run_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  PRIMARY KEY(run_id, turn_id, workspace_id, runtime_run_id, source_ref)
);
CREATE TABLE IF NOT EXISTS A008_run_continuation_source_events (
  run_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  runtime_run_id TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  event_cursor INTEGER NOT NULL REFERENCES A008_session_activity(cursor) ON DELETE CASCADE,
  PRIMARY KEY(run_id, turn_id, workspace_id, runtime_run_id, source_ref, tool_call_id),
  FOREIGN KEY(run_id, turn_id, workspace_id, runtime_run_id, source_ref)
    REFERENCES A008_run_continuation_sources(run_id, turn_id, workspace_id, runtime_run_id, source_ref)
    ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS A008_run_continuation_checkpoints (
  run_id TEXT NOT NULL REFERENCES A008_platform_runs(id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  runtime_run_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  format_version INTEGER NOT NULL CHECK(format_version = 1),
  maximum_state_bytes INTEGER NOT NULL CHECK(maximum_state_bytes > 0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  source_refs_json TEXT NOT NULL CHECK(json_valid(source_refs_json)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(run_id, turn_id, workspace_id, sequence)
);
CREATE INDEX IF NOT EXISTS A008_run_continuation_checkpoints_latest
  ON A008_run_continuation_checkpoints(run_id, turn_id, workspace_id, sequence DESC);
`;

export const PLATFORM_SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS A008_platform_schema (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS A008_platform_conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS A008_platform_conversations_scope
  ON A008_platform_conversations(tenant_id, project_id, updated_at DESC, id);
CREATE TABLE IF NOT EXISTS A008_platform_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES A008_platform_conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content_json TEXT NOT NULL CHECK (json_valid(content_json)),
  created_at INTEGER NOT NULL,
  run_id TEXT
);
CREATE INDEX IF NOT EXISTS A008_platform_messages_conversation
  ON A008_platform_messages(conversation_id, created_at, id);
CREATE TABLE IF NOT EXISTS A008_platform_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES A008_platform_conversations(id),
  workspace_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  lease_generation INTEGER NOT NULL,
  lease_owner_token TEXT,
  lease_expires_at INTEGER,
  dispatch_recorded INTEGER NOT NULL CHECK (dispatch_recorded IN (0, 1)),
  effect_status TEXT NOT NULL,
  answer_status TEXT NOT NULL,
  memory_status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS A008_platform_runs_conversation_nonterminal
  ON A008_platform_runs(tenant_id, project_id, conversation_id, status);
CREATE TABLE IF NOT EXISTS A008_platform_command_receipts (
  tenant_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  run_id TEXT NOT NULL REFERENCES A008_platform_runs(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(tenant_id, principal_id, command_id)
);
CREATE TABLE IF NOT EXISTS A008_platform_events (
  cursor INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  run_id TEXT,
  type TEXT NOT NULL,
  resource_revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS A008_platform_events_scope
  ON A008_platform_events(tenant_id, project_id, cursor);
`;
