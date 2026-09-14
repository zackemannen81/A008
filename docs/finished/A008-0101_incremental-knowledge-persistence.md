# A008-0101 — Incremental SQLite knowledge persistence

Task ID: A008-0101
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Last updated: 2026-09-14
Charter frozen at: 2026-09-14

## Task Charter

### Goal
Persist only changed project knowledge rows during ordinary writes while preserving
knowledge semantics, atomic rollback and read-only lifecycle evaluation.

### Primary Deliverable
An incremental SQLite write path with offline regression and write-volume evidence.

### In Scope
Existing SQLite context/store, serialization and derived indexes; evidence and
association strength, receipts, history, namespace and restart parity; synthetic
write-volume/timing measurements, documentation, archive and handoff.

### Out of Scope
PostgreSQL/Supabase, protocol/client changes, lifecycle policy changes, background
decay, engine-wide dirty tracking, schema redesign, live user-data migration,
live provider calls, deployment and publication.

### Definition of Done
Ordinary writes insert/update/delete only affected rows; unchanged rows and FTS
entries are untouched. No-op persistence writes nothing. Atomic rollback, stale
context refresh, restart, deletion and project isolation remain correct. L2/L3
and scenario suites pass. Full offline suite and build pass; measured limits
are documented. Archive/handoff exist and CURRENT_TASK is restored.

### Necessity Gate
Contract: docs/PROJECT_BRIEF.md, PC-04 — Durable knowledge with runtime authority.
Contract revision: dfea58ed6b1db0e3c27a9ba11d7030cbf3f098f9.
Accepted constraints: ADR 0018 storage follows knowledge semantics; ADR 0035 P1-P6
and KNOWLEDGE_MEMORY_MODEL preserve independent evidence/association lifecycles,
source-supported reinforcement, atomic receipts/history and pure lazy evaluation.
The owner selected incremental persistence as the next bounded implementation.

| Change | Outcome and omission consequence | Smallest sufficient approach | Verification |
| --- | --- | --- | --- |
| Incremental writes/indexes | Small durable changes must not rewrite unrelated knowledge/index rows; current write volume grows with unrelated project data | Compare before/after snapshots at SQLite boundary; keyed deltas in existing transaction; retain bulk replacement for migration | SQL mutation observer, no-op, index edits/deletions, 100/1000-record write-volume comparison |
| Transaction/lifecycle preservation | Failed writes must not leave strength, evidence, receipts/history inconsistent or overwrite refreshed state | Retain revision check, write lock, nested grouping and rollback hydration | Failure injection/retry, restart, namespaces, L2/L3/scenario and full offline suites |

## Minimum Verification Gates
- Mutation-volume regression, rollback/retry, stale context, namespaces and restart.
- Existing L2/L3, knowledge scenarios and full npm test; build/typecheck.
- Changed-document links/fences, current-task template identity and diff check.

## Checklist
- [x] Read authority, inspect snapshot writer and lifecycle evaluation.
- [x] Allocate identity on main before freezing charter.
- [x] Establish write-volume regression before implementation.
- [x] Implement keyed deltas using one canonical row serialization.
- [x] Verify rollback, indexes, restart and lifecycle parity.
- [x] Record measurements, limits and final necessity review.
- [x] Archive, handoff and restore current-task template.

## Decisions and Notes
Before/after snapshots remain in memory. This slice removes unrelated SQL writes,
not the O(project size) snapshot capture/comparison cost. No separately owned cache
is introduced. Existing schema and explicit bulk replacement remain for migration.
The row serializer is shared by both write strategies. FTS retains historical
multiplicity. Revisions must include local commit-time FTS changes while preserving
the external version captured under the lock; a targeted interleaving test protects
that refinement of the existing concurrency boundary.

## Verification
- Full npm test passed: 569 core, 4 membership, 161 GUI; no failures/skips.
- Root TypeScript build passed. Existing L2/L3 and scenario suites passed.
- Red regression before implementation: 1,412 / 14,020 SQLite mutations for
  one reinforcement with 100 / 1,000 fixtures; now four for both, three for
  independent edge recurrence, zero for no-op/replay and lazy evaluation.
- SQL-failure rollback/retry, index/deletion parity, namespaces, reopen and a
  commit-boundary external writer all pass. Synthetic disk benchmark at 10,000:
  bulk p50 859.35 ms versus incremental 247.88 ms; snapshot cost remains linear.
- Evidence: docs/evidence/A008-0101_incremental-persistence.md.
- Final necessity review: PC-04/ADR 0018/0035 still apply. Only SQLite persistence,
  derived indexes and the existing revision/rollback boundary changed; no new
  policy, schema, provider, protocol or client behavior.
- Changed-document links/fences, template byte identity and diff checks passed.
  All 25 serialized table column mappings match the previous schema-4 writer.
- No live user-data, host restart, provider, deployment or publication verification
  was performed; these are outside this local storage slice.

## Documentation Updates
CURRENT_STATUS, SYSTEMDOC, FILESTRUCTURE, archive, handoff/index. JOURNAL is
appended by the operator only on integration into main.

## Handoff and Follow-ups
Local implementation only. No running application restart or user database access
is needed for synthetic verification.
