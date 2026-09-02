# Current Task

Task ID: A008-0028
Parent Task: A008-0021
Status: Complete
Owner: A008-worker03
Created: 2026-09-02
Last updated: 2026-09-02
Charter frozen at: 2026-09-02

## Read First

- `AGENTS.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md` §12
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md` M7

## Task Summary

Storage only after the in-memory suite is green. Interval tables, slot
indexes, FTS over labels, and migration of existing supersede chains with
unknown boundaries recorded as `unknown`. Unblocked after A008-0027 merged.

## Task Charter

### Goal

Persist the accepted model so S1–S10 pass against SQLite with results
identical to the in-memory reference, then point live CLI/ACP at that engine
without reintroducing V3, V4, or V7.

### Primary Deliverable

SQLite adapter for the knowledge engine and live local-surface cutover.

### In Scope

- Storage for the new record families
- Migration of v0 supersede chains into intervals
- Live CLI/ACP composition cutover
- Docs: SEMANTIC_MEMORY, SYSTEMDOC, CURRENT_STATUS, FILESTRUCTURE
- Handoff `docs/handoffs/A008-0028.md`

### Out of Scope

- Live NVIDIA / paid calls
- OpenHands mutation
- Server-scale PostgreSQL
- Merging to `main`
- Growing `KnowledgeItem` instead of storing the new record families
- Leaving a filled `docs/CURRENT_TASK.md` in the pull request

### Definition of Done

ADR 0018 D9 items 3–5.

### Minimum Verification Gates

- [x] In-memory S1–S10 still green
- [x] SQLite S1–S10 identical
- [x] `npm run typecheck` and `npm test`
- [x] No live provider
- [ ] Handoff + PR; do not merge

## References

- ADR 0018 D9
- Depends on: A008-0027 merged (done)
- Worker clone: `C:\code\A008-workers\A008-worker03`
- Branch: `grok/A008-0028-storage-redesign`

## Checklist

- [x] Wait for M6 merge.
- [x] Design storage only then.
- [x] Migrate, prove parity, cut over local surfaces.
- [x] Verify, archive to `docs/finished/`, restore CURRENT_TASK template, handoff, push, PR.

## Decisions and Notes

- Do not start this task early. Starting storage before M6 is a defect.
- State, evidence, and lifecycle occupy separate SQLite tables. Unknown
  interval boundaries are stored as `{ unknown: true }`, never `now`.
- Live CLI/ACP no longer write `KnowledgeItem`. V0 rows migrate into intervals.

## Charter Amendment Log

- none

## Verification

- [x] `npm run typecheck` — exit 0
- [x] `npm test` — 210 pass, 0 fail. In-memory and SQLite S1–S10 plus
      identical-payload and close/reopen tests. No `.env.local`, no live
      provider.
- [x] `node --test dist/test/knowledge-model/scenarios.test.js` includes
      `S1–S10 sqlite payloads are identical to the in-memory reference`.
- Skipped: live NVIDIA, OpenHands mutation, merge to `main` (out of scope).
- Skipped: `docs/JOURNAL.md` append (operator on merge).

## Documentation Updates

- [x] `docs/SEMANTIC_MEMORY.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/LOCAL_MEMORY_SURFACES.md`
- [x] `docs/handoffs/A008-0028.md`

## Handoff and Follow-ups

- Current state: Complete on worker03; awaiting operator merge.
- Next recommended step: operator reviews and merges; parent A008-0021 can
  then complete D9.
- Blockers: none.
- Open questions: none.

## Finalize When Complete

- Archive this charter to `docs/finished/A008-0028_storage-redesign.md`
  with Status: Complete.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` before
  the last commit and push.
- Write `docs/handoffs/A008-0028.md`. Do not append `docs/JOURNAL.md`.
- Open a PR. Do not merge. Operator merges. Parent A008-0021 can then complete.
