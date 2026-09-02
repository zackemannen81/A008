# ADR 0006 — Runtime identity v0

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

A007 has a shared chat core, an ACP session boundary, and a semantic-memory
service, but their runtime identifiers were unrelated strings. The ACP bridge
generated a process-local bare UUID, the memory task contract accepted any
string, and no project-owned mapping contract existed for a project,
conversation, runtime task, agent, ACP session, or external conversation handle.

Persistent or automatic memory cannot safely key state until runtime identities
are distinct, validated, opaque, and resolvable without treating an identifier
as model-visible knowledge.

## Decision

- Runtime identity v0 defines five kinds: `project`, `conversation`, `task`,
  `agent`, and `acp_session`.
- The canonical form is
  `a007_v1_<kind>_<lowercase UUIDv4>`. The prefix/version/kind are routing and
  validation metadata; the UUID carries no user or task semantics.
- Branded TypeScript aliases prevent accidental cross-kind assignment at
  compile time. Runtime parsing verifies the complete format and expected kind.
- A runtime `task` ID is product state. It is unrelated to the docs-first task
  address `A007-NNNN`, which remains repository governance and status routing.
- External handles use a bounded `{system, kind, value}` reference. System and
  kind are canonical lowercase namespaces. The value is opaque control-plane
  data, not canonical a007 identity or model context.
- `AcpIdentityBinding` links one project, conversation, runtime task, agent, ACP
  session, and zero or more external references.
- `AcpIdentityBindingRepository` exposes idempotent registration plus lookups by
  ACP session, external reference, and conversation. It exposes no mutable map.
- ACP session IDs and external references are unique. Multiple ACP sessions may
  share a conversation only when project and agent remain identical; their
  runtime task IDs may differ.
- The first adapter is an atomic, concurrency-serialized in-memory reference.
  It registers on working copies, resolves conflicts before commit, and returns
  defensive records. It is not durable storage.
- The a007 ACP agent now generates canonical `acp_session` IDs by default.
  Injected IDs remain supported for tests/operators but must be canonical and
  unique within the process; malformed or duplicate values are rejected before
  session-map mutation.
- No binding is automatically registered by the ACP bridge yet. The current ACP
  new-session request provides working directory/MCP configuration but not an
  Agent Server conversation ID or the other four a007 application identities.

## Alternatives considered

### Keep bare UUID strings

Rejected. A bare value cannot be runtime-validated for project versus task
versus ACP-session use and offers no format version for migrations.

### Use Agent Server or Canvas IDs as a007 canonical IDs

Rejected. External ownership and lifecycle would leak through the application
core, prevent CLI parity, and make upstream format changes an a007 migration.

### Encode names, paths, prompts, or user identity in IDs

Rejected. It creates PII and rename leakage, makes identifiers semantic data,
and conflicts with the opaque-handle rule.

### Add durable identity storage now

Deferred. Schema migrations, encryption, retention, deletion, backup, ACLs,
multi-process locking, and external conversation intake need separate decisions.

### Register incomplete ACP bindings inside `newSession`

Rejected. Inventing project/conversation/task/agent values would create false
identity rather than a verified cross-component mapping.

## Consequences

- Code can distinguish and validate all five runtime identity kinds while
  keeping docs-task identity separate.
- ACP clients receive versioned canonical session IDs without a protocol change.
- Future orchestration has a repository port for complete verified mappings and
  deterministic conflict behavior.
- External values can still be sensitive even though they are not context; a
  persistence task must define privacy and lifecycle controls.
- Existing chat history and memory records are not migrated or bound by this
  task. Agent Server conversation intake, persistence, load/resume, and memory
  orchestration remain explicit follow-ups.
