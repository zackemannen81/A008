# Current Task

Task ID: A008-0024
Parent Task: A008-0021
Status: Ready
Owner: A008-worker02
Created: 2026-09-02
Last updated: 2026-09-02
Charter frozen at: 2026-09-02

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md` §2, §3, §4, §10.1 INTERPRET, §11 S3, §13
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md` V1, V8, V10 first half, M3
- `docs/MULTIAGENT.md`

## Task Summary

Introduce the new knowledge ontology and slot addressing in a new tree.
`proposition` is a label, never an identity. INTERPRET proposes only.
Scenario S3 must pass against the in-memory reference.

## Task Charter

### Goal

Close V1 (and the addressing half of V10) by making the addressable unit a
slot, with entity resolution as an explicit INTERPRET step.

### Primary Deliverable

`src/memory/knowledge/` in-memory types and INTERPRET such that S3 produces
one artifact, one symbol entity, typed relations/attributes — not three
unrelated strings.

### In Scope

- New files only under `src/memory/knowledge/`
- New tests only under `test/knowledge-model/`
- Add the new test file to `package.json` `test` script
- Types from model §13: Artifact, Entity, SlotRef, SlotDefinition, Instant,
  Interval, plus proposal types INTERPRET returns
- Clocks as types (`unknown` representable); no persistence
- Deterministic INTERPRET for structured source_code input (no live model)
- Failed entity resolution yields an unresolved-reference record, not a guess
- `docs/FILESTRUCTURE.md` listing of the new tree
- `docs/handoffs/A008-0024.md`
- Branch `CURRENT_TASK.md` copy of this charter

### Out of Scope

- Any edit to `src/memory/types.ts` / `KnowledgeItem`
- `src/memory/hybrid-memory-reader.ts`, `memory-engine.ts`, SQLite adapter
- RECONCILE / ACCEPT / UPDATE / lifecycle processes (M4–M6)
- Projection payload (M5)
- SQLite tables
- Live provider calls
- Merging to `main`
- Docs other than FILESTRUCTURE, this charter, and the handoff

### Definition of Done

- Slot addressing exists: attribute slot `(entityId, attribute)` and relation
  slot `(subjectId, relation, objectId?)`.
- Entity identity is not a natural-language label.
- INTERPRET writes nothing; it returns proposals with per-item confidence.
- S3 fixture: `main.cpp` containing `int main() { ... }` yields artifact
  `main.cpp` (`contentKind = source_code`), entity `main()`, relationship
  `main.cpp --contains--> main()`, attribute `main.return_type = int`.
- No who/why dimensions on those records (absent, not null).
- `unknown` time round-trips.
- Existing v0 tests remain green because this slice does not touch them.
- PR opened against `zackemannen81/A008` `main`.

### Minimum Verification Gates

- [ ] `npm run typecheck`
- [ ] `npm test` (existing plus new knowledge-model tests)
- [ ] Named S3 test
- [ ] No `KnowledgeItem` mutation
- [ ] No live provider / `.env.local` / OpenHands mutation
- [ ] `git diff --check`
- [ ] Handoff file complete; PR opened; do not merge

## References

- ADR 0018 D2, D3, D4
- Gap analysis M3
- Worker clone: `C:\code\A008-workers\A008-worker02`
- Branch: `grok/A008-0024-semantic-addressing`

## Checklist

- [ ] Copy this charter to `docs/CURRENT_TASK.md` on the worker branch.
- [ ] Add ontology types matching model §13 for referential + addressing + time.
- [ ] Implement in-memory entity/slot registries.
- [ ] Implement INTERPRET that proposes only.
- [ ] S3 test.
- [ ] Update FILESTRUCTURE.
- [ ] Verify, commit, push, open PR, write handoff.

## Decisions and Notes

- ADR 0018 is closed. Do not add clocks to `KnowledgeItem`.
- INTERPRET for this slice is deterministic and fixture-driven. A model-backed
  interpreter is later work and must not be invented here.
- Cardinality (`single` | `set`) belongs on `SlotDefinition` now so M4 can
  use it.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/FILESTRUCTURE.md`
- [ ] `docs/handoffs/A008-0024.md`

## Handoff and Follow-ups

- Current state: Ready, waiting for worker02.
- Next recommended step: implement on the named branch.
- Blockers: none.
- Child tasks: none. M4/M5 start after this merge.
- Resume condition: PR + handoff exist.
- Open questions: none.

## Finalize When Complete

- Operator merges. Worker does not archive the parent.
