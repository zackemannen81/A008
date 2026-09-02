# Current Task

Task ID: A007-0013
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
- `docs/POST_OUTPUT_KNOWLEDGE_INTAKE.md`
- `docs/RELATION_GATED_MEMORY_COMMIT.md`
- `docs/adr/0009-reasoning-and-post-output-intake.md`
- `docs/adr/0010-relation-gated-memory-commit.md`

## Task Summary

Join the implemented staging and one-proposal relation-commit boundaries behind
one provider-neutral coordinator with explicit sequential batch, partial-
failure, checkpoint, and index-repair behavior. Do not connect a live surface
or hide a second provider call.

## Task Charter

### Goal

Implement an application-owned post-output processing contract that stages one
message/final-answer pair once, processes proposals in deterministic order, and
makes every completed, failed, resumable, or repair-blocked state explicit.

### Primary Deliverable

An exported `PostOutputMemoryCoordinator` with typed batch records/checkpoints,
explicit completion/staging-failure/commit-failure/index-repair-required
results, safe retry/resume operations, deterministic tests, an owned ADR, and
durable contract documentation.

### In Scope

- Define narrow stager and relation-committer ports from the existing exported
  services; add no provider, repository, or environment dependency.
- Accept only `taskId`, original `message`, final `answer`, and caller-verified
  applicability scopes. Allocate an exact staging input object so extra
  completion/reasoning/control properties cannot cross this coordinator.
- Call staging exactly once for a fresh run. Return an explicit
  `staging_failed` result with zero commit calls when staging fails.
- Process staged proposals sequentially by stable zero-based index. Call the
  existing per-proposal committer once per attempted index and preserve ordered
  successful records.
- Treat `updated` and `not_required` as complete for one proposal. Stop on
  `pending_repair`, because later candidate comparison may depend on missing
  entity/domain metadata.
- Return a bounded repair checkpoint containing the validated staged batch,
  contiguous completed records, next proposal index, and the pending document.
  A repair-and-resume operation retries the index only, replaces the pending
  record with `updated`, and then continues with the next proposal without
  restaging or reconciling the repaired proposal again.
- Catch a per-proposal commit error as explicit `commit_failed` with a retry
  checkpoint at that same proposal. Resume retries only from that index; it does
  not restage or re-run earlier completed proposals.
- Validate checkpoint shape, exact batch serialization/identity kinds,
  contiguous record indexes, next index, and pending-document consistency
  before any retry/commit call. Invalid caller-constructed checkpoints fail
  before effects.
- Reject overlapping start, resume, and repair-and-resume operations on one
  coordinator instance.
- Ensure zero-proposal batches complete without a relation call and all returned
  arrays/checkpoint containers are defensive copies.
- Add fake/local tests for exact call ordering/counts, field/reasoning
  exclusion, zero proposals, stage failure, commit failure and resume, pending
  repair stop/retry/resume, repair failure, malformed checkpoints, defensive
  containers, and concurrency rejection.
- Add actual SQLite integration for a multi-proposal batch that performs
  different relations in order and proves later candidate comparison observes
  earlier indexed canon without restaging.
- Export the coordinator and update current truth, system/memory/intake/
  relation docs, public exports, file map, backlog, journal, and immutable task
  archive.

### Out of Scope

- A provider-backed analyzer or classifier adapter, prompts, model calls,
  embeddings, credentials, or changes to NVIDIA transport/provider ownership.
- Automatic invocation from `MemoryAwareChatSession`, `ChatSession`, CLI, ACP,
  Agent Server, Canvas, GUI, or any already-streamed user response lifecycle.
- Durable queue/checkpoint storage, background worker/scheduler, retry timing or
  count policy, telemetry, or user-facing notification/UI.
- Making the batch atomic, rolling back earlier canonical commits, parallel
  proposal processing, cross-batch ordering, idempotency keys, or solving the
  concurrent semantic-duplicate `new` race.
- Changing relation semantics, candidate ranking, activation/reinforcement,
  weakening/decay, lifecycle maintenance, privacy/retention/consent, access
  control, PostgreSQL/Supabase, Docker, deployment, publication, or release.

### Definition of Done

- One fresh call creates one exact staging input, stages once, and attempts each
  proposal in index order until complete, commit failure, or pending index
  repair.
- Stage failure performs zero relation calls and is distinguishable from a
  commit failure after earlier durable results.
- Commit failure reports the exact retry index and prior ordered results; resume
  never restages or repeats earlier completed proposals.
- Pending index repair stops the batch, preserves the canonically committed
  result, and repair-and-resume performs one index retry and no second reconcile
  for that proposal before continuing.
- Malformed checkpoints and overlapping operations fail before child calls.
- Reasoning/completion/control extras never enter staging input, checkpoint
  batch semantics, relation classifier context, or canonical memory.
- Actual SQLite proves proposal ordering and visibility of an earlier committed
  and indexed proposal during later candidate comparison.
- All prior tests, the two-turn benchmark, CLI/ACP/provider-free regressions,
  packaging, security, and documentation gates remain green.

### Minimum Verification Gates

- [x] Clean `npm ci`, production audit, strict typecheck/build, and full
      fake/local-only suite pass with zero failures.
- [x] Focused coordinator tests cover all result states, exact call counts and
      order, retry/resume non-repetition, repair stop/resume, malformed
      checkpoints, field exclusion, defensive containers, and overlap.
- [x] Actual in-memory SQLite multi-proposal integration proves earlier
      canonical/index state is visible to later candidate comparison.
- [x] Prior relation five-way/stale/index tests and
      `npm run benchmark:memory-loop` remain green and provider-free.
- [x] CLI help/models/missing-key and compiled ACP loopback regressions remain
      green without credentials.
- [x] Package dry-run, Markdown links/fences/indexes, task-template equality,
      staged secret/raw-legacy/database scan, and diff checks pass.
- [x] Record that no live provider, `.env.local`, external OpenHands process,
      Supabase service, Docker mutation, external database, deployment,
      publication, or release participated.

## References

- A007-0012 handoff in `docs/JOURNAL.md`.
- `docs/POST_OUTPUT_KNOWLEDGE_INTAKE.md`
- `docs/RELATION_GATED_MEMORY_COMMIT.md`
- `docs/adr/0009-reasoning-and-post-output-intake.md`
- `docs/adr/0010-relation-gated-memory-commit.md`

## Checklist

- [x] Adopt and document sequential batch/checkpoint/index-repair ownership.
- [x] Implement coordinator state/result/checkpoint validation and resume.
- [x] Export and test fake/local plus actual SQLite multi-proposal flow.
- [x] Run regression, benchmark, package, security, and documentation gates.
- [x] Update durable docs, archive A007-0013, and restore the task template.

## Decisions and Notes

- A `pending_repair` proposal is canonically committed but blocks later proposal
  comparison until optional entity/domain metadata is repaired.
- A committer exception is retryable at the same proposal only because the
  existing `RelationGatedMemoryCommit` contract returns post-canonical index
  failure as `pending_repair`; its thrown failures do not represent a hidden
  successful canonical commit.
- Checkpoints are runtime control state, never classifier or provider context.

## Charter Amendment Log

- none

## Verification

- [x] `npm ci` installed eight packages and audited nine; production audit found
      zero vulnerabilities. Strict typecheck/build and all 117 tests passed
      with zero failures, cancellations, skips, or todo.
- [x] Focused tests proved one exact staging call, ordered proposals, field/
      reasoning exclusion, zero proposals, explicit stage/commit failure,
      same-index resume without restaging/replay, pending-index barriers,
      failed/successful repair, no second reconcile, malformed-checkpoint zero-
      call rejection, defensive containers, and overlap rejection.
- [x] Actual in-memory SQLite staged two proposals once; the first created and
      indexed dormant canon, and the second retrieved and extended that same
      item. Final canon was revision two with ordered create/extend audit and
      exact/entity, lexical, tag, and domain retrieval.
- [x] `npm run benchmark:memory-loop` retained two reads/calls, repeated correct
      selection, `[0, 2]` prior-dialogue counts, 666/823 request bytes, four
      committed messages, and zero reasoning/control leakage. Observed
      9.933/2.741 ms turn times are not guarantees.
- [x] CLI help/models exited 0 without a key and missing-key chat exited 2.
      `npm pack --dry-run --json` reported 143 files including compiled
      coordinator JavaScript/declarations and no excluded runtime material.
- [x] Pre-archive 57 Markdown files had zero missing relative links, unbalanced
      fences, or index omissions; final archive/template, staged-content, and
      diff checks were repeated after closure.
- [x] No live provider, `.env.local`, external OpenHands process, Supabase
      service, Docker mutation, external database, deployment, publication, or
      release participated. The owner-authored README/image remained intact and
      the unrelated canonical lockfile metadata edit stayed outside this task.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` when structure changes
- [x] `docs/PROJECT_BRIEF.md`
- [x] `docs/SEMANTIC_MEMORY.md`
- [x] `docs/POST_OUTPUT_KNOWLEDGE_INTAKE.md`
- [x] `docs/RELATION_GATED_MEMORY_COMMIT.md`
- [x] `docs/MEMORY_AWARE_CHAT_ORCHESTRATION.md`
- [x] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: Complete; sequential post-output coordination is implemented,
  locally verified, documented, and ready for integration.
- Next recommended step: chartra provider-backed analyzer/classifier composition
  and its application/background owner only after credential, cost, durable
  retry, verified identity, privacy, and failure-presentation boundaries are
  explicit.
- Blockers: None.
- Child tasks: None.
- Resume condition: Not applicable.
- Open questions: Provider adapter/call ownership, durable queues, live identity
  intake, failure UI, privacy policy, and automatic invocation remain later
  tasks.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
