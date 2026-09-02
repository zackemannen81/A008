# Current Task

Task ID: A008-0012
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
Charter frozen at: 2026-09-01

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/SEMANTIC_MEMORY.md`
- `docs/HYBRID_MEMORY_READ_PATH.md`
- `docs/POST_OUTPUT_KNOWLEDGE_INTAKE.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/adr/0007-sqlite-hybrid-memory-read-path.md`
- `docs/adr/0009-reasoning-and-post-output-intake.md`

## Task Summary

Connect one staged semantic proposal to bounded current-candidate comparison,
one explicit five-way relation decision, atomic guarded canonical
reconciliation, and explicit retrieval-index maintenance without exposing
control IDs to a classifier or hiding partial index state.

## Task Charter

### Goal

Implement the first safe write-side orchestration boundary after staging so
untrusted semantic output can affect memory only through materialized candidate
comparison, runtime validation, stale-state guards, and the existing
`SemanticMemory.reconcile` owner.

### Primary Deliverable

An exported `RelationGatedMemoryCommit` plus bounded indexed candidate source,
ID-free classifier contract, guarded reconciliation support, explicit index
result/repair state, and actual SQLite integration tests for all five relations.

### In Scope

- Record the relation-classification, control-handle, stale-state, and
  post-reconcile index decision in an A008-owned ADR and durable contract doc.
- Process exactly one proposal from a validated `StagedKnowledgeBatch` per call;
  never auto-commit a complete batch with partial-success ambiguity.
- Revalidate batch identities, exact staged serialization, proposal index, and
  project namespace before candidate lookup.
- Add an indexed provider-neutral candidate source that derives a bounded
  project/scope-constrained exact/entity, lexical, tag, and domain plan from one
  staged proposal, calls the existing `MemoryCandidateStore`, deduplicates hits,
  and materializes current active or dormant `KnowledgeItem` candidates through
  `SemanticMemory`.
- Build a deterministic exact-budget classifier envelope containing the staged
  semantic proposal and bounded materialized candidate proposition/kind/tags/
  scope/authority/confidence/activation only. Exclude runtime IDs, knowledge
  IDs, revisions, scores, reasons, provenance, audit, and repository details.
- Give candidates stable invocation-local handles `candidate_1`,
  `candidate_2`, and so on. The classifier may return only `new`, or one of
  `restatement`/`extend`/`supersede` with one handle, or `conflict` with unique
  known handles. Runtime alone maps handles back to knowledge IDs.
- Trim optional candidate tail deterministically to the exact classifier budget;
  fail before classification if the proposal-only envelope cannot fit.
- Call the classifier exactly once and fail before any write on malformed,
  unknown-handle, duplicate-handle, empty-conflict, or over-budget output.
- Extend `SemanticMemory.reconcile` with an optional expected-revision guard
  validated inside its existing repository transaction. Existing unguarded
  callers retain current behavior.
- Reject overlapping operations on one relation-commit service and pass all
  materialized candidate revisions into the guarded reconciliation so targeted
  stale candidates cannot commit silently.
- Preserve existing five-way engine semantics. Conflict writes only audit;
  other successful relations return the canonical item.
- Maintain canonical-derived FTS/tag state in the existing repository
  transaction. Then upsert staged entity/domain retrieval metadata for the
  resulting current item through the existing candidate-store port.
- Return an explicit index state: `updated`, `not_required`, or
  `pending_repair`. An index failure after canonical commit must return the
  committed reconciliation plus a bounded retry document and never masquerade
  as a full rollback.
- Add an explicit retry method for a returned pending document; retry performs
  no second reconciliation.
- Add deterministic fake/local tests plus actual SQLite tests for new,
  restatement, extend, supersede, conflict, dormant candidate materialization,
  stale revision, invalid classifier output, budget trimming/failure,
  concurrency rejection, index failure/repair, and reasoning/control exclusion.
- Export the new surfaces and update durable documentation, benchmark/read-path
  descriptions, package inventory, and public-surface tests.

### Out of Scope

- A concrete provider-backed analyzer or relation-classifier adapter, a second
  model call, prompts for a live classifier, embeddings, or credentials.
- Automatic invocation from `MemoryAwareChatSession`, CLI, ACP, Agent Server,
  Canvas, or GUI; live verified identity intake and background job ownership.
- Automatically committing all staged proposals, cross-proposal transactions,
  semantic uniqueness constraints, or solving a concurrent `new` race with no
  database-level semantic key.
- Letting a classifier choose knowledge IDs, scope, authority, lifecycle,
  provenance, scores, activation, reinforcement amount, or index configuration.
- Weakening, decay, scheduled maintenance, archive/deletion, user approval UI,
  queues/retries beyond explicit index repair, telemetry, privacy/retention/
  consent policy, PostgreSQL/Supabase, Docker, deployment, publication, or
  release.

### Definition of Done

- The classifier sees bounded materialized meaning and local handles but no
  runtime/knowledge IDs or other control-plane fields.
- Exactly one staged proposal produces exactly one candidate search, one
  classifier call, and at most one guarded reconcile call.
- Every non-`new` relation maps only validated invocation-local handles to
  materialized current candidate IDs; invented or duplicate handles cause zero
  writes.
- Guarded reconcile rejects a changed target revision inside the repository
  transaction and preserves canon/audit.
- Successful new/restatement/extend/supersede results update canonical-derived
  indexes and attempt one entity/domain document upsert; conflict requires no
  document update.
- Post-commit index failure returns `pending_repair` with committed truth and a
  retryable document; successful retry changes index metadata only.
- Actual SQLite integration proves all five relations, dormant comparison,
  current/superseded state, audit, and subsequent retrieval behavior.
- Reasoning and control values deliberately placed in unrelated completion or
  classifier extra fields do not enter classifier context or canonical memory.
- All prior chat/CLI/ACP/provider/identity/memory/SQLite/retrieval/orchestration/
  staging tests and the memory-loop benchmark remain green.
- Current truth, system docs, semantic-memory docs, file map, public exports,
  decision index, journal, and immutable archive describe the boundary.

### Minimum Verification Gates

- [x] Clean `npm ci`, `npm audit --omit=dev`, strict typecheck, build, and full
      fake/local-only test suite pass with zero failures.
- [x] Focused candidate/classifier tests cover bounded search, deterministic
      ordering/handles/serialization, exact multibyte budget, tail trimming,
      dormant candidates, field exclusion, defensive copies, and one-call
      ownership.
- [x] Focused commit tests cover all five relations, malformed/unknown/duplicate
      handles, stale revision, concurrency, zero-write failures, index success,
      explicit pending repair, and repair without a second reconcile.
- [x] Actual in-memory SQLite integration proves post-commit exact/tag/domain/
      entity retrieval and canonical/audit state for each relation.
- [x] Prior `npm run benchmark:memory-loop`, CLI help/models/missing-key, ACP
      agent/process, and compiled loopback regressions remain provider-free and
      green.
- [x] Package dry-run includes every exported runtime artifact and excludes
      databases, credentials, raw legacy, dependency trees, and test fixtures.
- [x] Final Markdown links/fences/indexes, staged secret/raw-legacy/database
      scan, task-template equality, and `git diff --cached --check` pass.
- [x] Record that no live provider, `.env.local`, external OpenHands process,
      Supabase service, Docker mutation, external database, deployment,
      publication, or release participated.

## References

- A008-0011 handoff in `docs/JOURNAL.md`.
- `docs/POST_OUTPUT_KNOWLEDGE_INTAKE.md`
- `docs/SEMANTIC_MEMORY.md`
- `docs/HYBRID_MEMORY_READ_PATH.md`
- `docs/adr/0005-semantic-memory-v0-boundary.md`
- `docs/adr/0007-sqlite-hybrid-memory-read-path.md`
- `docs/adr/0009-reasoning-and-post-output-intake.md`

## Checklist

- [x] Adopt and document the relation-gated commit boundary.
- [x] Implement bounded indexed candidate materialization and ID-free envelope.
- [x] Implement classifier validation, guarded reconciliation, and index state.
- [x] Export and test all five relations with actual SQLite.
- [x] Run regression, benchmark, package, security, and documentation gates.
- [x] Update durable docs, archive A008-0012, and restore the task template.

## Decisions and Notes

- A `pending_repair` result is a committed canonical write with incomplete
  optional entity/domain metadata, not a failed transaction. FTS/tag canon is
  already maintained by the repository transaction.
- Candidate handles are invocation-local and carry no durable meaning.
- A relation classifier is untrusted semantic policy. `SemanticMemory` and its
  repository remain the only canonical transition authority.
- The first implementation cannot eliminate a concurrent semantic-duplicate
  `new` race without a later owned semantic uniqueness key. This limitation is
  explicit rather than hidden behind a false atomicity claim.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed eight packages and audited nine;
      `npm audit --omit=dev` found zero vulnerabilities. Strict typecheck/build
      and all 109 tests passed with zero failures, cancellations, skips, or
      todo.
- [x] Focused fake/local tests proved deterministic bounded candidate search,
      dormant materialization, defensive copies, exact multibyte budgeting and
      tail trimming, semantic-only local handles, malformed-decision zero-write
      behavior, all-candidate revision guards, overlap rejection, and index
      repair without a second reconcile.
- [x] Actual in-memory SQLite tests executed all five relations, verified
      dormant/current/historical canon and audit, retrieved committed state
      through exact/entity, lexical, tag, and domain channels, and rejected a
      during-classification revision change with `stale_state`.
- [x] `npm run benchmark:memory-loop` retained two reads/calls, repeated correct
      selection, `[0, 2]` prior-dialogue counts, 666/823 request bytes, four
      committed messages, and zero reasoning/control leakage. Observed
      9.908/2.713 ms turn times are not guarantees.
- [x] CLI help/models exited 0 without a key and missing-key chat exited 2.
      `npm pack --dry-run --json` reported 139 files including compiled relation
      JavaScript/declarations and no excluded runtime material.
- [x] Pre-archive 54 Markdown files had zero missing relative links, unbalanced
      fences, or index omissions; final archive/template, staged-content, and
      diff checks were repeated after closure.
- [x] No live provider, `.env.local`, external OpenHands process, Supabase
      service, Docker mutation, external database, deployment, publication, or
      release participated. The owner-authored README/image commits on `main`
      were preserved by rebasing this work after them. The unrelated canonical
      lockfile metadata edit remained outside this worktree and task.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/SEMANTIC_MEMORY.md`
- [x] `docs/HYBRID_MEMORY_READ_PATH.md`
- [x] `docs/POST_OUTPUT_KNOWLEDGE_INTAKE.md`
- [x] `docs/MEMORY_AWARE_CHAT_ORCHESTRATION.md`
- [x] ADR and ADR index

## Handoff and Follow-ups

- Current state: Complete; bounded relation-gated write orchestration is
  implemented, locally verified, documented, and ready for integration.
- Next recommended step: chartra the application-owned post-output coordinator
  that invokes analyzer then per-proposal relation commit with explicit failure
  presentation, without yet wiring incomplete live identity surfaces.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: Later tasks must choose provider-backed classifier ownership,
  automatic/background invocation, semantic uniqueness, batch policy, live
  identity intake, user review controls, and lifecycle weakening/decay.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
