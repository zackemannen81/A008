# Current Task

Task ID: A008-0025
Parent Task: A008-0021
Status: Ready
Owner: unassigned (wave 2)
Created: 2026-09-02
Last updated: 2026-09-02
Charter frozen at: 2026-09-02

## Read First

- `AGENTS.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md` §5, §10.1 RECONCILE/UPDATE, S1, S2, S8, S10
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md` V2, V3, V10, V11, M4

## Task Summary

Split state from history on the new knowledge engine. Bindings have intervals.
`canonicalStatus` / `supersede` are not part of the new engine. Blocked until
A008-0024 is merged.

## Task Charter

### Goal

Close V2, V3, V11, and the state-machine half of V10: current is
`validTo = null`; history is interval lists; conflicts are contested, not
discarded.

### Primary Deliverable

Deterministic `RECONCILE` and `UPDATE` over slots, with S1, S2, S8, and S10
passing in-memory.

### In Scope

- `src/memory/knowledge/` state, history, transition, RECONCILE, UPDATE
- Tests under `test/knowledge-model/` for S1, S2, S8, S10
- Handoff `docs/handoffs/A008-0025.md`

### Out of Scope

- SQLite schema
- `KnowledgeItem` field additions
- ACCEPT policy and utterance records (M5), except as stub ids UPDATE can
  point at
- Lifecycle (M6)
- Merging to `main`
- Live provider calls

### Definition of Done

S1, S2, S8, S10 pass. UPDATE writes no lifecycle field. Conflict retains both
claims and leaves no accepted binding.

### Minimum Verification Gates

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Named S1, S2, S8, S10 tests
- [ ] No live provider
- [ ] Handoff + PR; do not merge

## References

- ADR 0018 D4, D6
- Depends on: A008-0024 merged to `main`
- Branch: `grok/A008-0025-state-history-split`

## Checklist

- [ ] Wait for A008-0024 merge.
- [ ] Implement RECONCILE and UPDATE.
- [ ] Scenario tests.
- [ ] Verify, commit, push, PR, handoff.

## Decisions and Notes

- Blocked on A008-0024. Do not start on a stale main.
- CHANGE versus CORRECTION must not collapse.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact checks and outputs.

## Documentation Updates

- [ ] `docs/handoffs/A008-0025.md`

## Handoff and Follow-ups

- Current state: Ready, blocked on A008-0024.
- Next recommended step: operator assigns a clone after M3 merge.
- Blockers: A008-0024.
- Open questions: none.

## Finalize When Complete

- Operator merges.
