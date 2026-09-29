# A008-0196 — Bounded intra-turn context and continuation state

Task ID: A008-0196
Parent Task: A008 runtime context compaction and budget recovery program
Status: Complete
Owner: A008 (operator)
Created: 2026-09-28
Last updated: 2026-09-29
Charter frozen at: 2026-09-29 on `main` revision `ae118e1`

## Task Summary

The tool loop in `src/core/chat-session.ts` appends every completed assistant
tool-call round and result to the next provider request. Long tool turns
therefore project an ever-growing raw execution history, even though prior
completed work can be represented as a bounded continuation state. This is the
first bounded slice of the four-task program in
`docs/backlog/A008-runtime-context-compaction-budget-recovery.md`.

## Task Charter

### Goal

Allow the active tool loop to replace eligible old completed tool interactions
in provider context with a validated, bounded, source-linked continuation state,
while retaining a configurable recent raw interaction tail and all in-flight
operations. Raw source messages are not deleted or rewritten by compaction.

### Primary Deliverable

An opt-in, typed continuation-state contract and completed-interaction
projection in the shared `ChatSession` tool loop, with deterministic tests that
prove bounded projected tool history and preservation of recent/in-flight raw
interactions and source references.

### In Scope

- Define and validate versioned per-run continuation state, including separate
  verified facts, hypotheses, completed actions, and raw-event source refs.
- Identify complete assistant-tool rounds by stable per-run source references;
  only completed rounds older than the configured recent interaction tail are
  eligible for compaction.
- Accept a caller-supplied compactor, validate its result and byte bound before
  atomically replacing projected old interactions with continuation state.
- Preserve canonical raw interaction messages for the duration of the run and
  leave them untouched on validation/compactor failure.
- Keep existing behavior unchanged unless the caller explicitly enables the
  continuation policy; do not silently truncate input or tool history.
- Add deterministic unit/integration coverage, register the test in `test:core`,
  and update implementation/status documentation and handoff.

### Out of Scope

- Persisted checkpoints, database/schema changes, restart recovery or any new
  scheduler; these belong to later tasks in the program.
- Automatic model/LLM summarization, context-budget detection, threshold policy,
  provider-request rebuilding, or claims that execution continues after a hard
  provider limit.
- Changes to inter-turn history, A008 semantic-memory retrieval/extraction,
  provider contracts, tool execution semantics, GUI, or client APIs.
- Dropping, rewriting or deleting canonical raw execution history.

### Definition of Done

- A 100+ synthetic completed-tool-interaction run with continuation enabled
  projects bounded tool history: one bounded state plus the configured raw tail,
  rather than all interactions.
- Every retained verified fact, hypothesis and completed action has resolvable
  source references into the active run's preserved raw events; hypotheses stay
  distinct from verified facts.
- Recent interactions remain byte-for-byte raw; incomplete/in-flight tool rounds
  are never compacted or projected without their pending results.
- Invalid, oversized, or source-incomplete compactor output cannot replace a
  previously valid continuation state or remove source interactions.
- Default `ChatSession` calls and all non-opted-in callers preserve current
  wire-history behavior.
- Root typecheck/build and focused tests pass; `test:core` membership and
  `git diff --check` pass. Owning status/system docs and a handoff are updated.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `ae118e1` (reviewed at charter freeze)

| Change                                                        | Clause and accepted constraint                                                                                                                                                                                                                                      | Outcome; consequence if omitted                                                                                                                                                                                                                      | Smallest sufficient change                                                                                                                                                 | Planned check                                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bounded intra-turn provider projection and continuation state | PC-LF-03: A008 owns retrieval and context construction. Accepted constraint: `docs/backlog/A008-runtime-context-compaction-budget-recovery.md` separates unfinished-turn runtime continuity from completed-turn semantic memory and retains raw execution evidence. | Fix: `ChatSession` currently appends each completed tool round/result to every subsequent request; a long turn grows provider context linearly and can fail before the accepted work is finished. Omitting this leaves that concrete path unbounded. | Add an opt-in completed-round selector, validated bounded continuation state with source refs, and preserve a recent raw tail; do not alter durable memory or raw history. | Deterministic 100+ round tool-loop test measures projected history and checks retained raw tail, provenance, in-flight protection and invalid-replacement behavior. |

### Minimum Verification Gates

- [x] Unit tests validate continuation-state shape, byte limit, source refs, and
      separation of verified facts from hypotheses.
- [x] Deterministic `ChatSession` tool-loop test with 100+ rounds proves bounded
      projection and preserves configured recent raw interactions.
- [x] Failure/in-flight tests prove no compaction across unfinished operations
      and no replacement on invalid/oversized/incomplete compactor output.
- [x] Existing callers remain unchanged; root typecheck/build and core-suite
      membership pass.
- [x] Review actual diff against the Necessity Gate; `git diff --check` passes.

### Verification Budget

- Live verification purpose / required provider behavior: not needed; deterministic local transport/compactor fixtures verify this core projection contract.
- Budget owner / parent allocation: A008; no live allocation.
- Policy revision / inherited or explicit approved limits: `docs/TASK_WORKFLOW.md` at `ae118e1`; not-needed/zero.
- max_live_verification_cost (amount + currency): 0 SEK.
- max_live_verification_calls (all physical attempts): 0.
- max_input_tokens_per_call / max_output_tokens_per_call: 0 / 0.
- live_call_timeout_seconds: 0.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: no workers; no live calls.

## References

- `docs/backlog/A008-runtime-context-compaction-budget-recovery.md` — approved program proposal and task-1 candidate boundaries.
- `docs/PROJECT_BRIEF.md` — PC-LF-03 context ownership.
- `docs/TASK_WORKFLOW.md` — Necessity Gate and task lifecycle.
- `src/core/chat-session.ts`, `src/core/types.ts`, `src/core/chat-invocation.ts` — current tool-loop and provider wire composition.
- `test/chat-session.test.ts`, `test/core-suite-membership.test.ts`, `package.json` — regression suite and test registration.

## Checklist

- [x] Inspect current tool-loop composition and preserve compatible default behavior.
- [x] Implement validated continuation state and source-linked completed-round projection.
- [x] Add 100+ round, recent-tail, in-flight and invalid replacement regressions; register tests.
- [x] Run minimum verification gates and review diff against the frozen necessity argument.
- [x] Update `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, task index and handoff.
- [x] Archive the completed record and restore `docs/CURRENT_TASK.md` from its template before delivery.

## Decisions and Notes

- Ready freezes the outcome, scope and minimum gates above. Runtime-level compaction is opt-in through an explicit caller-supplied reducer: this slice does not claim a production semantic summarizer or automatic activation.
- Continuation state is temporary runtime context, not semantic memory. It cannot change A008 retrieval, current state, knowledge lifecycle or completed-turn projection.
- A source ref denotes a raw interaction retained by the active `ChatSession` run. Persistence/recovery and source retention after the run are later-task decisions.
- No provider calls, paid or otherwise, are authorized or needed.
- Final hardening preserves provider chronology as current user message → continuation state → recent raw assistant/tool rounds; compacted tool output is never projected before the user request that caused it.
- Each replacement state must retain source coverage already represented by the previous valid state plus newly compacted interactions. The reducer receives a detached clone of the complete prior run-bound state, including `runId`.
- The frozen repo-wide membership gate exposed two tracked pre-existing tests (`file-routes.test.ts`, `skill-library.test.ts`) that were absent from `test:core`. Registering those existing tests is the smallest verification-infrastructure repair needed to make the frozen membership gate truthful; it changes no product behavior.

## Charter Amendment Log

- none

## Verification

- [x] Review actual changes against the necessity arguments and frozen scope.
- [x] Record exact checks and outputs.
- [x] Record skipped checks and reasons.

Final local verification on 2026-09-29, using the canonical checkout's installed
`node_modules` through a temporary worktree junction; no packages were installed
and the junction is removed after verification:

- `npm run typecheck --silent`: **PASS**.
- `npm run build --silent`: **PASS**.
- `node --test dist/test/chat-continuation.test.js dist/test/chat-session.test.js`:
  **17/17 PASS**.
- Continuation suite includes the 100-completed-interaction bounded projection,
  byte/provenance validation, invalid replacement, unfinished batch protection,
  default-off compatibility, provider wire ordering, cumulative source coverage,
  and full prior-state/run binding checks.
- `node --test dist/test/core-suite-membership.test.js`: **4/4 PASS** after
  registering the two already tracked tests omitted by the base `test:core` list.
- `git diff --check`: **PASS**.
- No live provider calls; observed verification spend **0 SEK**.
- An additional exploratory full `test:core` run was started after membership
  repair and exposed failures in unrelated Platform/model/host fixtures outside
  this frozen task. It was stopped and is not used as A008-0196 completion
  evidence; no out-of-scope fixes were absorbed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` — operator appends on merge to `main`, per repository policy.
- [x] `docs/FILESTRUCTURE.md` reviewed; no high-level repository-map change required.
- [x] Task collection index and handoff

## Handoff and Follow-ups

- Current state: Complete on the task branch; implementation, focused verification, archive and handoff are present.
- Next recommended step: operator reviews/merges A008-0196, then A008-0197 may implement durable continuation checkpoints within its separately frozen scope.
- Blockers: none for A008-0196.
- Child tasks: none.
- Resume condition: none; reopen only for a verified regression in this delivered slice.
- Open questions: continuation reducer remains supplied by the runtime caller; concrete semantic reduction, budget-trigger activation and persistence remain intentionally outside A008-0196.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from `docs/template_CURRENT_TASK.md`.
- Write `docs/handoffs/A008-0196.md`.
- The operator appends a signed `docs/JOURNAL.md` entry on merge to `main`.
