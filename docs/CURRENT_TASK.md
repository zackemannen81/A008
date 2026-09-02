# Current Task

Task ID: A008-0021
Parent Task: None
Status: In Progress
Owner: Grok (operator / boss)
Created: 2026-09-02
Last updated: 2026-09-02
Charter frozen at: 2026-09-02, after claim of A008-0021 through A008-0028 on `main`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/MULTIAGENT.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md`

## Task Summary

Close the knowledge-model gap to 100%. The v0 `KnowledgeItem` engine conflates
meaning, truth, time, and salience. The accepted constitution is
`docs/KNOWLEDGE_MEMORY_MODEL.md`. This parent owns sequencing, ADR direction,
worker briefing, merge to `main`, and the final cutover. Children implement
one frozen phase each.

## Task Charter

### Goal

Make A008's knowledge and memory implementation satisfy laws L1–L12 and
acceptance scenarios S1–S10, closing gap-analysis findings V1–V15, including
SQLite parity (M7) and live CLI/ACP composition without reintroducing V3, V4,
or V7.

### Primary Deliverable

An in-memory knowledge engine under `src/memory/knowledge/` that is the
canonical owner of ontology, slot addressing, state/history, evidence,
lifecycle, retrieval intents, and the typed projection payload; a later SQLite
adapter with identical scenario results; live local surfaces using that engine.

### In Scope

- Adopt the model (A008-0022 / ADR 0018).
- M1 eligibility repair on the v0 read path (A008-0023).
- M3 semantic addressing in a new tree (A008-0024).
- M4 state/history split (A008-0025).
- M5 first-class evidence and ACCEPT (A008-0026).
- M6 evidence-only lifecycle and retrieval intents (A008-0027).
- M7 storage redesign after M6 is green (A008-0028).
- Operator-owned merge to `main`, combined verification, and documentation
  cutover.
- Worker clones under `C:\code\A008-workers`, own branches, pull requests.

### Out of Scope

- Live NVIDIA / paid provider calls.
- OpenHands source mutation, Canvas browser re-proof, desktop packaging.
- Adding fields to `KnowledgeItem` to simulate the new model.
- SQLite table/index/FTS/embedding design before M6 is green.
- Renaming historical `docs/finished/` or `docs/evidence/` A007 filenames.
- Making the multi-agent process add-on part of the application runtime.

### Definition of Done

ADR 0018 D9: V1–V15 closed; S1–S10 pass in-memory; S1–S10 pass on SQLite with
identical results; live CLI/ACP uses the new engine without V3/V4/V7;
`docs/SEMANTIC_MEMORY.md` describes the accepted model as implemented.

### Minimum Verification Gates

- [ ] ADR 0018 accepted, index updated, model status Accepted.
- [ ] Each child merged only after its frozen gates and a `docs/handoffs/` record.
- [ ] `npm run typecheck` and `npm test` green on `main` after every merge.
- [ ] S1–S10 in-memory suite green before M7 starts.
- [ ] S1–S10 SQLite suite matches in-memory results.
- [ ] No live provider, `.env.local`, or OpenHands mutation in automation.

## References

- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md`
- Frozen children under `docs/tasks/`
- Worker root `C:\code\A008-workers`

## Checklist

- [x] Claim A008-0021 through A008-0028 on `main`.
- [x] Accept the model via ADR 0018 and lock D1–D11.
- [x] Freeze parent and child charters.
- [ ] Merge A008-0023 (M1) from worker01 PR.
- [ ] Merge A008-0024 (M3) from worker02 PR.
- [ ] Brief and merge A008-0025 (M4).
- [ ] Brief and merge A008-0026 (M5).
- [ ] Brief and merge A008-0027 (M6).
- [ ] Brief and merge A008-0028 (M7).
- [ ] Combined verification and documentation cutover.
- [ ] Archive this task and restore the current-task template.

## Decisions and Notes

- Operator is sole `main` merger. Workers PR only. Code plus handoff is
  evidence; worker transcripts are not loaded for review.
- Wave 1 uses existing clones `A008-worker01` (M1) and `A008-worker02` (M3).
  Later waves may add clones up to eight.
- M2 is not a task (ADR 0018 D3).
- A008-0025 and A008-0026 stay Ready but blocked until A008-0024 is merged.
- Concurrent-writer cap for this program is eight.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact checks and outputs after each merge.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [x] `docs/adr/0018-knowledge-and-memory-model.md`
- [ ] `docs/CURRENT_STATUS.md` after first child merge
- [ ] `docs/SYSTEMDOC.md` when behavior exists
- [ ] `docs/JOURNAL.md` after M0 landing and after each merge
- [x] `docs/FILESTRUCTURE.md` for tasks/handoffs/ADR 0018
- [x] ADR collection index

## Handoff and Follow-ups

- Current state: M0 accepted; wave 1 workers to implement M1 and M3.
- Next recommended step: merge wave-1 PRs in any order; then start M4/M5.
- Blockers: none for wave 1.
- Child tasks: A008-0022 (this landing), A008-0023..A008-0028.
- Resume condition: a child PR is open with a `docs/handoffs/` record.
- Open questions: none that reopen ADR 0018. Cutover timing of live CLI/ACP
  onto the new engine is an operator merge decision after M6.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
