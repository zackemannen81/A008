# Current Task

Task ID: A007-0018
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

A live NVIDIA run showed provider reasoning leaking into committed assistant
content, contaminating post-output analysis, and driving a thinking-enabled
semantic call that timed out. Trace order and duplicated memory_failure events
made the turn look like a chat failure. This task isolates reasoning from
knowledge and repairs those live-path defects.

## Task Charter

### Goal

Guarantee that provider reasoning has no path into committed dialogue, analyzer
input, retrieval history, or canonical proposals, and that a successful chat
answer is never reported as a failed turn when only post-output memory fails.

### Primary Deliverable

NVIDIA SSE channel-transition normalization with a live-format regression
fixture, a bounded non-thinking semantic generation profile, ordered traces,
deduplicated memory diagnostics, and a hard invariant that no emitted reasoning
substring reaches knowledge surfaces.

### In Scope

- Characterize raw NVIDIA SSE chunk channel transitions for the observed
  Nemotron leak: `reasoning_content` prefix, then `content` containing
  chain-of-thought continuation plus the user-visible answer.
- Normalize streamed and non-streamed NVIDIA completions so reasoning never
  enters `ChatCompletion.message.content` or content deltas used by CLI/ACP.
- Add a live-format fixture reproducing the observed stream shape.
- Force semantic JSON operations onto their own bounded non-thinking
  generation profile (`enableThinking: false`, no reasoning budget, limited
  max tokens, `stream: false`).
- Pass only the verified final answer into `PostOutputKnowledgeIntake`.
- Emit `memory_read` at the actual read, assign HTTP call IDs, and flush the
  chat HTTP clone before post-output so traces follow execution order.
- Emit `memory_failure` once. Successful chat with failed memory is a
  degraded memory outcome, not a failed chat turn.
- Add the invariant: no substring emitted as reasoning may appear in analyzer
  input, committed history, retrieval dialogue, or canonical proposal source.

### Out of Scope

- Changing retrieval, relation, or activation semantics.
- Live/paid provider calls by the implementation agent.
- OpenHands source changes, Canvas GUI replay, decay policy, or a native
  thinking UI.

### Definition of Done

- [x] Live-format SSE fixture is classified by channel transitions and
      normalized so only the user-visible answer is content.
- [x] Existing clean reasoning/content streams still stream as today.
- [x] Semantic analyzer/classifier requests never send thinking or a 16384
      reasoning budget.
- [x] Intake `answer` equals verified final content and contains no reasoning
      substring from the fixture.
- [x] Trace order is turn_start, memory_read, chat, then post-output; HTTP
      responses pair to their request; memory_failure appears once.
- [x] `turn_complete` is `ok` or `degraded`, not `error`, when chat succeeded.
- [x] The holy invariant test passes.

### Minimum Verification Gates

- [x] Strict typecheck/build and full suite including the new fixture and
      invariant tests.
- [x] Existing CLI/ACP/memory-loop/reasoning-isolation tests remain green.
- [x] Package dry-run, Markdown, template, and `git diff --check`.
- [x] No live NVIDIA call is required for automated completion.

## References

- Live raw trace of the SQLite question turn (operator evidence).
- `src/providers/nvidia/nvidia-chat-transport.ts`
- `src/orchestration/semantic-json-model.ts`
- `src/runtime/local-memory-runtime.ts`
- `docs/adr/0009-reasoning-and-post-output-intake.md`
- `docs/adr/0015-reasoning-has-no-path-to-knowledge.md`

## Checklist

- [x] Owner reviews and freezes the reasoning-isolation charter.
- [x] Freeze the reviewed charter in a separate commit.
- [x] Implement NVIDIA channel characterization and content normalization.
- [x] Add the live-format SSE fixture and transport regression.
- [x] Bound semantic generation to a non-thinking profile.
- [x] Repair intake answer, trace order, duplicate failure, and degraded turn.
- [x] Add the holy invariant test and update owning docs.

## Decisions and Notes

- Holy invariant: REASONING MUST HAVE NO PATH TO KNOWLEDGE.
- Prefer holding `content` deltas until the stream ends when
  `reasoning_content` was seen and the buffered content looks like
  chain-of-thought, then split at the answer boundary.
- Clean short answers after a reasoning channel still stream as content.
- Semantic calls never inherit chat `enableThinking` / `reasoningBudget`.

## Charter Amendment Log

- none

## Verification

- [x] Typecheck/build and all 158 tests passed, including the live leak
      fixture and holy invariant.
- [x] Semantic requests omit reasoning budgets and force `enableThinking:
      false`.
- [x] Skipped: live NVIDIA re-run; the captured stream is the regression
      fixture. `log.txt` was not committed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: Complete. Reasoning has no path to knowledge on the live
  NVIDIA stream shape.
- Next recommended step: owner may re-run the SQLite question live to confirm
  the split still matches current Nemotron output.
- Blockers: none.
- Child tasks: None allocated.
- Resume condition: Not applicable.
- Open questions: none remaining for this slice.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
