# Current Task

Task ID: A008-0027
Parent Task: A008-0021
Status: Complete
Owner: A008-worker02
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
REINFORCE. Retrieval intents including history. Full S1–S10 suite. Unblocked
after A008-0025 and A008-0026 merged.

## Task Charter

### Goal

Close V5, V12, V14, V15: history is reachable; tags are not truth; strength
is not retrieval_score; decay exists and cannot change a direct-state answer.

### Primary Deliverable

Evidence-only lifecycle processes, retrieval intents, and the full scenario
suite green in-memory.

### In Scope

- New files under `src/memory/knowledge/` for lifecycle and the read-path
  processes DEFINE / RETRIEVE / EXPAND / FILTER / COMPOSE / PROJECT
- May export them from `src/memory/knowledge/index.ts`
- May add `test/knowledge-model/scenarios.test.ts` to `package.json` `test`
- Consume temporal hints (`mentionsPast` / history intent) so closed
  intervals are reachable
- Tests: full model §11 (S1–S10) plus a decay sweep that changes no
  direct-question answer
- `docs/handoffs/A008-0027.md`
- Branch copy of this charter into `docs/CURRENT_TASK.md` while working only

### Out of Scope

- SQLite redesign (M7)
- Live provider
- Merging to `main`
- Growing `KnowledgeItem`
- Editing `interpret.ts`, `state.ts`, `reconcile.ts`, `update.ts`,
  `ingest.ts`, `accept.ts` unless a one-line export/import is required to
  call them
- Leaving a filled `docs/CURRENT_TASK.md` in the pull request

### Definition of Done

Full S1–S10 pass. Decay sweep does not change any direct-question answer.
PROJECT writes nothing.

### Minimum Verification Gates

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Full scenario suite
- [x] Decay sweep test
- [x] No live provider
- [ ] Handoff + PR; do not merge

## References

- ADR 0018 D7, D9
- Depends on: A008-0025 and A008-0026 merged (done)
- Worker clone: `C:\code\A008-workers\A008-worker02`
- Branch: `grok/A008-0027-evidence-lifecycle-intents`

## Checklist

- [x] Wait for M4 and M5 merge.
- [x] Implement lifecycle and intents.
- [x] Full suite.
- [x] Verify, archive to `docs/finished/`, restore CURRENT_TASK template, handoff, push, PR.

## Decisions and Notes

- Unblocked. Direct match ignores memory state. Associative expansion
  filters dormant evidence. PROJECT writes nothing. Strength is not a
  direct-match score term.
- Lifecycle attaches only to utterance, event, claim, and artifact-summary
  evidence. Bindings, transitions, entities, and artifact identity have no
  memory strength.
- DEFINE consumes planner-shaped `mentionsPast` / `currentOnly` /
  `mentionsFuture` hints. Closed intervals are retrieved only under history
  intent.

## Charter Amendment Log

- none

## Verification

- [x] `npm run typecheck` — exit 0
- [x] `npm test` — 189 pass, 0 fail (includes S1–S10 and the decay sweep)
- [x] Isolated `node --test dist/test/knowledge-model/scenarios.test.js` —
  16 pass, 0 fail
- [x] No live provider, `.env.local`, or OpenHands mutation

## Documentation Updates

- [x] `docs/handoffs/A008-0027.md`
- [x] `docs/finished/A008-0027_evidence-lifecycle-intents.md`
- [x] `docs/CURRENT_TASK.md` restored from `docs/template_CURRENT_TASK.md`

## Handoff and Follow-ups

- Current state: Complete on worker02; PR for operator merge.
- Next recommended step: operator reviews and merges; A008-0028 (M7) remains
  blocked until this slice is green on `main`.
- Blockers: none.
- Open questions: none.

## Finalize When Complete

- Archive this charter to `docs/finished/A008-0027_evidence-lifecycle-intents.md`
  with Status: Complete.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md` before
  the last commit and push.
- Write `docs/handoffs/A008-0027.md`. Do not append `docs/JOURNAL.md`.
- Open a PR. Do not merge. Operator merges.
