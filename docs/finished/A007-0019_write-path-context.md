# Current Task

Task ID: A008-0019
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
- Relevant records under `docs/adr/`

## Task Summary

A008-0018 isolated live NVIDIA reasoning and bounded semantic calls. Remaining
defects are ambient user-assertion state that can race across turns, HTTP
traces without operation labels, coarse turn-complete status, and stale
current-truth about live write-path, RAG, and tag/domain recall.

## Task Charter

### Goal

Make user-assertion activation take the original user message from explicit
write-path context, reject overlapping session turns through post-output, label
HTTP traces by operation, and restore docs-first current truth.

### Primary Deliverable

`sourceMessage` on staged batches, injected `activateNewProposal` at guarded
commit, a whole-turn session lock, HTTP `operation` on provider events, explicit
`chatStatus`/`memoryStatus` on turn completion, and corrected status/system
docs plus an ADR for reinforcement evidence.

### In Scope

- Carry original user text as `sourceMessage` on `StagedKnowledgeBatch`.
- Apply the user-assertion gate only from that batch field at `new` reconcile.
- Remove `UserAssertionMemoryPort` mutable `#message` / `setCurrentMessage`.
- Reject a second `LocalMemorySession.turn` until chat and post-output settle.
- Add `operation=chat|knowledge_analysis|relation_classification` on HTTP
  request/response traces alongside `httpCallId`.
- Emit `turn_complete` with `chatStatus` and `memoryStatus`; keep overall
  `degraded` when chat succeeded and memory failed.
- Record that live hybrid read has no embedding provider and an empty planner
  taxonomy; RAG and tag/domain read channels are optional/future live adapters.
- Record the reinforcement evidence decision: validated `restatement`/`extend`
  currently boost regardless of user vs assistant origin.
- Repair CURRENT_STATUS rows that still claim A008-0016-only and disconnected
  relation-gated live invocation.

### Out of Scope

- Changing five-way relation semantics or the +0.2 boost amount.
- Enabling live embeddings, knownTags, or knownDomains.
- Weaken/decay, OpenHands changes, or live NVIDIA re-runs.

### Definition of Done

- [x] Overlapping turns cannot change another turn's assertion decision.
- [x] `new` activation uses `batch.sourceMessage` only.
- [x] HTTP traces name the provider operation and share `httpCallId`.
- [x] `turn_complete` carries chat and memory statuses.
- [x] Current truth matches live composition, RAG, and taxonomy limits.

### Minimum Verification Gates

- [x] Typecheck/build and full suite including a concurrent-turn race test.
- [x] Existing user-assertion, reasoning-isolation, and CLI/ACP tests remain green.
- [x] Package dry-run, Markdown, template, and `git diff --check`.

## References

- `src/runtime/user-assertion-gate.ts`
- `src/orchestration/relation-gated-memory-commit.ts`
- `src/runtime/debug-trace.ts`
- `docs/CURRENT_STATUS.md`
- `docs/adr/0014-live-write-path-reinforcement.md`

## Checklist

- [x] Owner reviews and freezes this charter.
- [x] Freeze the reviewed charter in a separate commit.
- [x] Bind sourceMessage through staging and guarded commit.
- [x] Lock the whole session turn and add the race test.
- [x] Label HTTP operations and explicit turn statuses.
- [x] Repair current truth, journal, archive, and restore the template.

## Decisions and Notes

- Reinforcement of `restatement`/`extend` remains +0.2 after a validated
  relation, whether the supporting text came from the user message or the
  assistant answer. Restricting boosts to user-backed evidence is a later
  policy task.
- Live retrieval is entity/exact plus lexical FTS. Vector RAG and planner
  tag/domain channels exist in architecture but are not configured live.

## Charter Amendment Log

- none

## Verification

- [x] Typecheck/build and all 160 tests passed, including overlapping-turn
      sourceMessage isolation and HTTP operation labels.
- [x] Skipped: live NVIDIA re-run; enabling embeddings/taxonomy.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed
- [x] `docs/LOCAL_MEMORY_SURFACES.md`

## Handoff and Follow-ups

- Current state: Complete.
- Next recommended step: optional later tasks for live RAG/taxonomy or
  user-backed-only reinforcement.
- Blockers: none.
- Child tasks: None allocated.
- Resume condition: Not applicable.
- Open questions: none remaining for this slice.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
