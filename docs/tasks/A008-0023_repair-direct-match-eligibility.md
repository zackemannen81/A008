# Current Task

Task ID: A008-0023
Parent Task: A008-0021
Status: Ready
Owner: A008-worker01
Created: 2026-09-02
Last updated: 2026-09-02
Charter frozen at: 2026-09-02

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md` §1, §7, §8, §10.2, S6, S7
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md` V4, V6, V7, M1
- `docs/HYBRID_MEMORY_READ_PATH.md`
- `docs/MULTIAGENT.md`

## Task Summary

Repair the v0 read path so a dormant exact/direct hit is eligible and a
dormant 1-hop associative hit is not. Stop `project()` from writing. This is
gap-analysis M1: defect repair, no schema change.

## Task Charter

### Goal

Close V4, V6, and V7 on the existing `KnowledgeItem` path without adding
fields to that record and without starting the new knowledge tree.

### Primary Deliverable

Direct-match projection that ignores activation for exact/direct channel hits;
associative hits still filtered by dormant; `project()` non-mutating;
regression tests for reduced S6 and S7.

### In Scope

- `src/memory/hybrid-memory-reader.ts`
- `src/memory/hybrid-retrieval-policy.ts`
- `src/memory/memory-engine.ts` eligibility, `project()`, `projectSelected`
  only
- Tests under `test/hybrid-memory-reader.test.ts` and
  `test/memory-engine.test.ts`
- Docs: `docs/HYBRID_MEMORY_READ_PATH.md`; one factual correction in
  `docs/SEMANTIC_MEMORY.md` that dormant exact hits may cross projection
- `docs/handoffs/A008-0023.md`
- Branch `CURRENT_TASK.md` copy of this charter

### Out of Scope

- `src/memory/types.ts` schema changes
- SQLite schema, FTS, embeddings
- `src/memory/knowledge/`
- Replacing five-way reconcile
- Decay/weaken implementation
- Live provider calls
- Merging to `main`

### Definition of Done

- A dormant, exact-matched current record is returned for a direct question.
- A dormant 1-hop / associative record is omitted for an associative question,
  with an explicit reason.
- Direct-channel scoring does not use memory strength (`weights.strength = 0`
  for exact-channel candidates).
- `SemanticMemory.project()` writes nothing. Reinforcement, if still present,
  is a named explicit call, not a read side effect.
- Existing tests remain green except those that encoded the withdrawn
  "dormant cannot project" rule; those tests are rewritten to the new rule.
- PR opened against `zackemannen81/A008` `main`.

### Minimum Verification Gates

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] Focused S6/S7 reduced tests named in verification
- [ ] No `KnowledgeItem` field added
- [ ] No live provider / `.env.local` / OpenHands mutation
- [ ] `git diff --check`
- [ ] Handoff file complete; PR opened; do not merge

## References

- ADR 0018 D7
- Gap analysis M1
- Worker clone: `C:\code\A008-workers\A008-worker01`
- Branch: `grok/A008-0023-repair-direct-match-eligibility`

## Checklist

- [ ] Copy this charter to `docs/CURRENT_TASK.md` on the worker branch.
- [ ] Remove activation gate from exact/direct projection eligibility.
- [ ] Keep the gate for associative hits; record the distinction in reasons.
- [ ] Zero strength weight for exact-channel candidates.
- [ ] Make `project()` non-mutating.
- [ ] Add S6/S7 reduced tests.
- [ ] Update named docs.
- [ ] Verify, commit, push, open PR, write handoff.

## Decisions and Notes

- ADR 0018 is closed. Do not reopen eligibility vs lifecycle.
- `required_not_eligible` must not fire for a dormant direct match.
- Do not absorb M3 addressing into this slice.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/HYBRID_MEMORY_READ_PATH.md`
- [ ] `docs/SEMANTIC_MEMORY.md` (eligibility sentence only)
- [ ] `docs/handoffs/A008-0023.md`

## Handoff and Follow-ups

- Current state: Ready, waiting for worker01.
- Next recommended step: implement on the named branch.
- Blockers: none.
- Child tasks: none.
- Resume condition: PR + handoff exist.
- Open questions: none.

## Finalize When Complete

- Operator merges. Worker does not archive the parent.
