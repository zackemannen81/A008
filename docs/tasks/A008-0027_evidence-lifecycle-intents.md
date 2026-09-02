# Current Task

Task ID: A008-0027
Parent Task: A008-0021
Status: Ready
Owner: unassigned (wave 3)
Created: 2026-09-02
Last updated: 2026-09-02
Charter frozen at: 2026-09-02

## Read First

- `AGENTS.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md` §7, §8, §10.2, §10.3, full §11
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md` V5, V12, V14, V15, M6

## Task Summary

Move lifecycle onto evidence only. Named DECAY / WEAKEN / REACTIVATE /
REINFORCE. Retrieval intents including history. Full S1–S10 suite. Blocked
until A008-0025 and A008-0026 are merged.

## Task Charter

### Goal

Close V5, V12, V14, V15: history is reachable; tags are not truth; strength
is not retrieval_score; decay exists and cannot change a direct-state answer.

### Primary Deliverable

Evidence-only lifecycle processes, retrieval intents, and the full scenario
suite green in-memory.

### In Scope

- Lifecycle processes and intented RETRIEVE / EXPAND / FILTER / COMPOSE /
  PROJECT on the new engine
- Consume planner temporal hints for history intent
- Tests: full §11 plus a decay sweep that changes no direct-question answer
- Handoff `docs/handoffs/A008-0027.md`

### Out of Scope

- SQLite redesign (M7)
- Live provider
- Merging to `main`

### Definition of Done

Full S1–S10 pass. Decay sweep does not change any direct-question answer.
PROJECT writes nothing.

### Minimum Verification Gates

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Full scenario suite
- [ ] Decay sweep test
- [ ] No live provider
- [ ] Handoff + PR; do not merge

## References

- ADR 0018 D7, D9
- Depends on: A008-0025 and A008-0026 merged
- Branch: `grok/A008-0027-evidence-lifecycle-intents`

## Checklist

- [ ] Wait for M4 and M5 merge.
- [ ] Implement lifecycle and intents.
- [ ] Full suite.
- [ ] Verify, archive to `docs/finished/`, restore CURRENT_TASK template, handoff, push, PR.

## Decisions and Notes

- Blocked on M4 and M5.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact checks and outputs.

## Documentation Updates

- [ ] `docs/handoffs/A008-0027.md`

## Handoff and Follow-ups

- Current state: Ready, blocked on A008-0025 and A008-0026.
- Blockers: M4 and M5.
- Open questions: none.

## Finalize When Complete

- Archive this charter to `docs/finished/A008-0027_evidence-lifecycle-intents.md`
  with Status: Complete.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` before
  the last commit and push.
- Write `docs/handoffs/A008-0027.md`. Do not append `docs/JOURNAL.md`.
- Open a PR. Do not merge. Operator merges.
