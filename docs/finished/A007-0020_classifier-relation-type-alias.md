# Current Task

Task ID: A008-0020
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

Live NVIDIA relation classification returned valid JSON
`{"relation":"new","targetHandle":null}` for empty-candidate proposals. Runtime
looks only at exact `type` and reports `policy: relation classifier returned an
unknown type`, so a successful chat turn degrades at proposal 0. This task
accepts bounded aliases of the five canonical relations without inventing a
relation the model did not choose.

## Task Charter

### Goal

Make live classifier JSON that names a canonical five-way relation under a
known field alias commit, while still failing closed on unknown, missing, or
conflicting relation names.

### Primary Deliverable

Bounded classifier-decision normalization in `RelationGatedMemoryCommit`, a
tighter classifier instruction that names field `type`, a live-shape fixture,
and an error that includes the actual returned type.

### In Scope

- Accept JSON field `relation` as an alias for `type` when it names one of
  `new`, `restatement`, `extend`, `supersede`, or `conflict`.
- Trim and case-fold those names; treat JSON `null` as omitted for `type`,
  `relation`, and unused `targetHandle` on `new`.
- Fail closed when the two fields disagree, when the name is not one of the
  five canonical strings, or when a required handle is missing or unknown.
- Include the actual returned name in the unknown-type error.
- Tighten `KNOWLEDGE_RELATION_CLASSIFIER_INSTRUCTION` so the required JSON
  field is `type`.
- Add a live-shape fixture and tests for the observed NVIDIA payload and the
  fail-closed cases.

### Out of Scope

- Inventing mappings such as `create` to `new` or `update` to `extend`.
- Markdown-fenced or prose-wrapped semantic JSON.
- Changing five-way reconciliation semantics, activation, or +0.2 boosts.
- Live/paid NVIDIA calls by the implementation agent.
- OpenHands source changes, Canvas GUI replay, decay/weaken policy, embeddings,
  or planner taxonomy.

### Definition of Done

- [x] The live payload `{ relation: "new", targetHandle: null }` with empty
      candidates commits as `{ type: "new" }`.
- [x] Canonical `{ type: "new" }` and the other four relations still work.
- [x] Unknown names, missing type, and conflicting `type`/`relation` fail
      before reconcile or index, and the unknown-type error names the value.
- [x] The classifier instruction requires field `type`.
- [x] Current truth records the live alias defect and the bounded fix.

### Minimum Verification Gates

- [x] Strict typecheck/build and the full fake/local suite including the live
      alias fixture and fail-closed cases.
- [x] Existing relation, semantic-JSON, CLI/ACP, and memory-loop tests remain
      green.
- [x] Package dry-run, Markdown, template, and `git diff --check`.

## References

- `src/orchestration/relation-gated-memory-commit.ts`
- `src/orchestration/semantic-json-model.ts`
- `docs/RELATION_GATED_MEMORY_COMMIT.md`
- `docs/SEMANTIC_JSON_MODEL_CALLS.md`
- Operator `log.txt` classify_response payloads (untracked; not committed)
- `docs/adr/0017-classifier-relation-type-alias.md`

## Checklist

- [x] Owner reviews and freezes this charter.
- [x] Freeze the reviewed charter in a separate commit.
- [x] Normalize bounded classifier aliases and fail-closed errors.
- [x] Tighten the classifier instruction and add live-shape tests.
- [x] Repair current truth, journal, archive, and restore the template.

## Decisions and Notes

- Live Nemotron used `relation` because the instruction said "Choose exactly
  one relation" without naming JSON field `type`. The five canonical names
  remain the only accepted relations.
- `targetHandle: null` on `new` is omitted, not a handle. Restatement, extend,
  supersede, and conflict still require real known handles.
- Do not commit `log.txt` or `.grok/`.

## Charter Amendment Log

- none

## Verification

- [x] `npm run typecheck` exited 0.
- [x] `npm test` exited 0 with 164/164 fake/local-only tests, 0 fail/skip/todo.
- [x] `npm pack --dry-run --json` reported 171 files including compiled
      relation-commit and semantic-json artifacts; no tests or `log.txt`.
- [x] `git diff --check` was clean.
- [x] Skipped: live NVIDIA re-run; Markdown-fenced JSON; invented `create`/
      `update` mappings.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed
- [x] `docs/RELATION_GATED_MEMORY_COMMIT.md`
- [x] `docs/SEMANTIC_JSON_MODEL_CALLS.md`

## Handoff and Follow-ups

- Current state: Complete.
- Next recommended step: optional later work for live RAG/taxonomy or
  user-backed-only reinforcement. Analyzer still extracts ephemeral chat events
  such as `/Inställningar`; that is a separate intake-policy question.
- Blockers: none.
- Child tasks: None allocated.
- Resume condition: Not applicable.
- Open questions: none remaining for this slice.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
