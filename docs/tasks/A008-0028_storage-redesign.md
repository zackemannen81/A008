# Current Task

Task ID: A008-0028
Parent Task: A008-0021
Status: Ready
Owner: unassigned (wave 4)
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
unknown boundaries recorded as `unknown`. Blocked until A008-0027 is merged.

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

### Definition of Done

ADR 0018 D9 items 3–5.

### Minimum Verification Gates

- [ ] In-memory S1–S10 still green
- [ ] SQLite S1–S10 identical
- [ ] `npm run typecheck` and `npm test`
- [ ] No live provider
- [ ] Handoff + PR; do not merge

## References

- ADR 0018 D9
- Depends on: A008-0027 merged
- Branch: `grok/A008-0028-storage-redesign`

## Checklist

- [ ] Wait for M6 merge.
- [ ] Design storage only then.
- [ ] Migrate, prove parity, cut over local surfaces.
- [ ] Verify, archive to `docs/finished/`, restore CURRENT_TASK template, handoff, push, PR.

## Decisions and Notes

- Do not start this task early. Starting storage before M6 is a defect.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact checks and outputs.

## Documentation Updates

- [ ] `docs/SEMANTIC_MEMORY.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/handoffs/A008-0028.md`

## Handoff and Follow-ups

- Current state: Ready, blocked on A008-0027.
- Blockers: M6.
- Open questions: none.

## Finalize When Complete

- Archive this charter to `docs/finished/A008-0028_storage-redesign.md`
  with Status: Complete.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` before
  the last commit and push.
- Write `docs/handoffs/A008-0028.md`. Do not append `docs/JOURNAL.md`.
- Open a PR. Do not merge. Operator merges. Parent A008-0021 can then complete.
