# Current Task

Task ID: A008-0023
Parent Task: A008-0021
Status: In Progress
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

- [x] `npm run typecheck`
- [x] `npm test`
- [x] Focused S6/S7 reduced tests named in verification
- [x] No `KnowledgeItem` field added
- [x] No live provider / `.env.local` / OpenHands mutation
- [x] `git diff --check`
- [x] Handoff file complete; PR opened; do not merge

## References

- ADR 0018 D7
- Gap analysis M1
- Worker clone: `C:\code\A008-workers\A008-worker01`
- Branch: `grok/A008-0023-repair-direct-match-eligibility`

## Checklist

- [x] Copy this charter to `docs/CURRENT_TASK.md` on the worker branch.
- [x] Remove activation gate from exact/direct projection eligibility.
- [x] Keep the gate for associative hits; record the distinction in reasons.
- [x] Zero strength weight for exact-channel candidates.
- [x] Make `project()` non-mutating.
- [x] Add S6/S7 reduced tests.
- [x] Update named docs.
- [x] Verify, commit, push, open PR, write handoff.

## Decisions and Notes

- ADR 0018 is closed. Do not reopen eligibility vs lifecycle.
- `required_not_eligible` must not fire for a dormant direct match.
- Do not absorb M3 addressing into this slice.
- Exact-channel candidates use `weights.strength = 0` at score time; the
  stored policy still sums to 1 and associative hits still use strength.
- `project()` and `projectSelected` no longer write reinforcement, activation,
  revision, or audit. Write-path `reconciliationReinforcement` remains the
  named explicit reinforcement call.
- Origin `main` imported `./A008-acp-agent.js` while the blob was still
  `src/acp/a007-acp-agent.ts`, so `npm run typecheck` could not run. The file
  was renamed to the documented A008 path so the frozen gates can execute.
  No ACP behavior change.

## Charter Amendment Log

- none

## Verification

- [x] Record exact checks and outputs.
- [x] Record skipped checks and reasons.

Commands and results (2026-09-02, worker01, Node v24.14.1):

- `npm run typecheck` — pass (`tsc -p tsconfig.json --noEmit`, exit 0).
- `npm test` — pass: 167 tests, 0 fail, duration_ms 9287.14. Focused S6/S7:
  `S6 reduced: dormant exact/direct hit is projected without mutation`,
  `S7 reduced: dormant associative hit is omitted with an explicit reason`,
  `S6 reduced: a dormant current record is returned for a direct question`,
  `exact-channel scoring zeros memory strength; associative scoring keeps it`.
- `git diff --check` — pass (no output, exit 0).
- `src/memory/types.ts` — unchanged; no `src/memory/knowledge/` created.
- No live provider, `.env.local`, or OpenHands mutation.

Skipped: none of the frozen gates. An initial `npm test` under the agent
environment failed one out-of-scope ACP process assertion because both
`NO_COLOR` and `FORCE_COLOR` were set; re-running without those variables
was green. That is an environment warning, not a product defect.

## Documentation Updates

- [x] `docs/HYBRID_MEMORY_READ_PATH.md`
- [x] `docs/SEMANTIC_MEMORY.md` (eligibility sentence only)
- [x] `docs/handoffs/A008-0023.md`

## Handoff and Follow-ups

- Current state: implementation committed; PR open; handoff on this branch.
- Next recommended step: operator reviews and merges the PR.
- Blockers: none.
- Child tasks: none.
- Resume condition: operator merge of https://github.com/zackemannen81/A008/pull/2
- Open questions: none.

## Finalize When Complete

- Operator merges. Worker does not archive the parent.
