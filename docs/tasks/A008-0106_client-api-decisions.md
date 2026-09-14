# A008-0106 - Client API decisions

Task ID: A008-0106
Parent Task: A008-0103
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Charter frozen at: 2026-09-14

## Frozen charter
Goal: resolve the V2, project/session ownership, auth and recovery decisions
required before the next program implementations.
Deliverable: accepted ADR and implementable protocol/lifecycle decision record.
Scope: existing-data binding; shared runtime ownership; v1/ACP compatibility;
identities, transport/DTO boundaries, auth profiles and scopes; turn/event,
snapshot/idempotency limits; release/platform verification obligations.
Out of scope: runtime implementation, database migration, durable conversation,
background runs, multiple writers to one session, new native product features.
Done: choices and failure outcomes are explicit, consistent with frozen program
and current code; next implementation gates recorded; docs/hash/links/fences,
archive/handoff/template pass. Owner authorized push/PR/merge for this task.

## Necessity Gate
Contract: PROJECT_BRIEF at 5ff163d, PC-01/04/05/06, ADR 0040 and A008-0103.
Supported clients must share existing runtime/knowledge owners (PC-01/04), retain
execution/credential controls (PC-05) and supported user surfaces (PC-06).
The next code cannot safely choose project-data binding or invent auth/recovery
semantics independently. Smallest sufficient approach: one accepted decision
record over existing HTTP/WS and runtime boundaries. Verify each chosen behavior
against engine host, standalone bridge, runtime config/identity and the frozen
plan; record implementation obligations instead of claiming unbuilt guarantees.

## Mutable checklist / verification
- [x] Resolve and document decisions.
- [x] Check consistency, scope, links/fences and frozen plan hash.
- [x] Archive/handoff/template and prepare authorized publication; operator records merge.

## Evidence and handoff
Reviewed current engine registry/panel/session owner, standalone bridge environment,
project registry and runtime identity/SQLite sidecar resolution. ADR 0041 and
CLIENT_API_V2.md decide the target without claiming implementation. Decisions
fit PC-01/04/05/06 and unchanged frozen plan. Docs-only; runtime tests do not
apply. Links/fences, plan hash, diff and archive/template identity verified.
Publication authorized by owner; operator records actual merge in journal.
