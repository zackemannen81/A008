export const PLATFORM_SQLITE_SCHEMA_VERSION = 2;

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
