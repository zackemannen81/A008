# Current Task

Task ID: A008-0197
Parent Task: `docs/backlog/A008-runtime-context-compaction-budget-recovery.md` (program proposal)
Status: In Progress
Owner: Rickard (operator)
Created: 2026-09-29
Last updated: 2026-09-29
Charter frozen at: 2026-09-29
## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant accepted top-level records under `docs/adr/`; never use `docs/adr/_legacy/` as current authority

## Task Summary

A008-0196 is the prerequisite and is now delivered. It delivers the
validated `RunContinuationState` and source-reference contract, this task will
make that unfinished-turn state durable in A008's existing local PlatformStore.
The checkpoint must remain execution state, distinct from semantic memory and
from the authoritative raw execution evidence. 
Verify that every A008-0196 source reference has a stable durable representation in PlatformStore, 
or define the smallest binding from the runtime interaction ID to an already-authoritative durable event. 
Do not persist a checkpoint whose provenance only exists in process memory.
Checkpoints inherit lifecycle ownership from the authoritative run; this task adds no independent retention policy. 
Existing run deletion/cleanup must either cascade checkpoint deletion transactionally or 
explicitly preserve it according to the existing run-retention contract.

## Task Charter

### Goal

Persist and retrieve validated continuation checkpoints for an unfinished
platform run, bound to its run, turn, and workspace, without losing or copying
the raw evidence they reference or exposing checkpoint data as semantic memory.

### Primary Deliverable

An additive, versioned Platform SQLite persistence capability owned by
`PlatformStore`, with validated atomic checkpoint writes, reads, and selection
of the latest valid checkpoint for its exact run/turn/workspace. It consumes the
continuation-state and source-reference contract delivered by A008-0196.

### In Scope

- Review the completed A008-0196 deliverable and bind checkpoint payload
  validation and source-reference handling to its actual types/schema; do not
  invent a parallel representation.
- Add an additive migration to the then-current Platform SQLite schema and
  store APIs for versioned checkpoints, including run/turn/workspace identity,
  monotonically ordered checkpoint sequence, validated payload, and source refs.
- Validate on write and read; reject malformed, mismatched, or unresolved
  run/turn/workspace/source references. A newer invalid checkpoint must not
  hide an earlier valid checkpoint.
- Make each save atomic. A failed validation or storage transaction must leave
  the previously committed valid checkpoint readable.
- Keep source references resolvable to retained raw execution events; do not
  copy raw history wholesale, rewrite/delete source evidence, or make checkpoints
  candidates in normal A008 knowledge retrieval.
- Add deterministic migration, persistence, validation, ordering, failure and
  retrieval-isolation tests; document the implemented owner and schema behavior.

### Out of Scope

- Implementing or changing Task 1's context compaction/state format, or Task 3's
  budget trigger, context rebuild, and same-turn continuation orchestration.
- Process-restart recovery, resuming an unfinished turn, workspace reconciliation,
  retry/replay policy, or new scheduler behavior (Task 4 and existing owners).
- Provider calls, UI/client controls, public protocol/API changes, semantic-memory
  redesign, cross-turn retrieval, raw-event retention/deletion policy, or a new
  SQLite database/namespace.
- Fixed context thresholds, tool-count limits, or checkpoint retention policy
  not required by the accepted contract and this deliverable.

### Definition of Done

- A008-0196 is complete; its validated continuation-state and source-reference
  contract is reviewed and used without duplicating it.
- PlatformStore persists checkpoints in the existing local Platform database
  through an additive migration from the schema version current at implementation.
- Checkpoints are validated and unambiguously bound to their run, turn and
  workspace; sequence/latest-valid selection is deterministic and scoped exactly.
- Atomic-write/transaction failure leaves the prior valid checkpoint usable;
  corrupt or mismatched checkpoints cannot silently replace/override it.
- Every stored source reference resolves to retained raw evidence, and the raw
  execution record remains authoritative and unmodified by checkpoint writes.
- Tests prove round-trip, restart/read, schema migration/version handling,
  invalid-input rejection, ordering/latest-valid fallback, failed-write
  preservation, source-reference resolution, and isolation from ordinary
  semantic-memory retrieval.
- Owning implementation documentation is updated; actual changes pass the
  necessity review and all minimum verification gates below.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `ae118e163cf555923079469595308bf143675e1b`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Persist validated unfinished-turn checkpoints in the local platform owner | PC-LF-05 (durable project sessions), PC-LF-07 (local state remains authoritative); A008-0196 state/source-reference contract; PC-LF-03 (execution metadata is not semantic memory) | Protects the same unfinished run's continuation state from process loss; without durable, run-bound state there is no safe checkpoint for later recovery, and unscoped storage risks attaching it to the wrong workspace or treating it as knowledge | Add one versioned checkpoint store to the existing PlatformStore/SQLite owner; validate identity and source refs and commit each checkpoint atomically; keep raw events and semantic-memory paths separate | Focused PlatformStore migration/round-trip/fault-injection tests, exact binding/reference tests, and a regression through ordinary knowledge retrieval proving checkpoints are absent |


### Minimum Verification Gates

- [ ] Root TypeScript typecheck/build pass.
- [ ] Focused PlatformStore/checkpoint tests pass, including schema migration
  from the then-current version, process/store reopen, schema validation,
  run/turn/workspace and source-reference checks, deterministic latest-valid
  selection, and injected transaction failure preserving the previous checkpoint.
- [ ] Existing PlatformStore and platform-host integration suites pass.
- [ ] Ordinary semantic-memory retrieval isolation regression passes; no
  checkpoint data is returned or committed through the knowledge path.
- [ ] `git diff --check` passes; review migration and actual changes against the
  necessity argument, Task 1 interface, and frozen scope.
- [ ] Record exact commands/results and any skipped checks; no live provider
  verification is needed or authorized by this charter.

### Verification Budget

No live verification required. Local deterministic tests only; no provider calls.

- Live verification purpose / required provider behavior: Not needed.
- Budget owner / parent allocation: Not applicable; zero live-call allocation.
- Policy revision / inherited or explicit approved limits: `docs/TASK_WORKFLOW.md` as reviewed at freeze; live verification not needed.
- max_live_verification_cost (amount + currency): 0 SEK.
- max_live_verification_calls (all physical attempts): 0.
- max_input_tokens_per_call / max_output_tokens_per_call: 0 / 0.
- live_call_timeout_seconds: 0.
- Approved provider/model routes / credential-source references: None.
- Price reference and checked-at / billing units / currency conversion / allowance: Not applicable; no live calls.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 SEK / 0 / none / 0 / 0 SEK.
- Worker allocations or serialized dispatch; resume retains prior usage: No worker/live dispatch; zero allocation.

## References

- `docs/backlog/A008-runtime-context-compaction-budget-recovery.md` — Task 2 candidate outcome, acceptance evidence, and shared boundaries.
- `docs/PROJECT_BRIEF.md` — PC-LF-03, PC-LF-05 and PC-LF-07.
- `docs/adr/0055-durable-sessions-and-process-ownership.md` — local durable session/run ownership and conservative recovery boundary.
- `src/platform/platform-store.ts`, `src/platform/sqlite-schema.ts`, `src/platform/types.ts` — current persistence owner and run/schema contracts (reviewed at `ae118e163cf555923079469595308bf143675e1b`; re-inspect after Task 1).
- A008-0196's completed deliverable — required source of truth for continuation state and source-reference validation before freeze/implementation.

## Checklist

- [x] Wait for A008-0196 completion; inspect its delivered contract and current PlatformStore/schema changes.
- [x] Resolve the process-local A008-0196 source-ID blocker with explicit source-ref to retained activity-event bindings. Operator approved this prerequisite.
- [x] Implement the additive schema-v5 tables and checkpoint bind/save/latest-valid read APIs; root typecheck/build and one round-trip/reopen test pass locally.
- [ ] Add migration, malformed/mismatched input, latest-valid fallback, transaction-failure preservation and retrieval-isolation tests.
- [ ] Integrate/check source binding against actual durable GUI tool activity emissions.
- [ ] Run full focused PlatformStore and platform-host suites without timeout; update SYSTEMDOC/CURRENT_STATUS, then archive and hand off.

## Decisions and Notes

- A008-0196 source IDs are `${runtimeRunId}:n` and are process-local. PlatformStore now binds them explicitly to retained completed activity event cursor/tool IDs; checkpoint validation still uses the canonical Task 1 payload validator.
- PlatformStore was schema v4 at implementation; schema v5 is additive. Legacy v1-v3 migration paths create the current activity/config tables, then advance to the present schema.
- Platform `runId`/workspace and runtime `runId` remain distinct. `turnId` is the accepted platform run ID for this API. No identity is inferred from timestamps or text.
- Checkpoint rows cascade with the authoritative platform run. This slice does not resume work or authorize replay; existing run/effect semantics remain authoritative.
- Root typecheck/build passed; focused checkpoint round-trip/reopen passed (1/1). A combined checkpoint + platform store + platform host test invocation exceeded the command time limit after several passing PlatformStore/host tests; it is not a full-suite pass. Semantic-memory isolation and failure-injection gates remain unverified.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` (integration entry by operator on merge)
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs and collection indexes when needed by the implemented contract

## Handoff and Follow-ups

- Current state: In progress; additive persistence and explicit provenance binding implemented locally.
- Next recommended step: Add fault/migration/fallback/isolation regressions and wire durable event bindings to actual runtime callbacks.
- Blockers: Remaining frozen DoD tests and owning docs.
- Child tasks: None proposed.
- Resume condition: None.
- Open questions: Verify caller can associate every Task 1 interaction with the durable completed activity event(s) before saving.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task. template: template_CURRENT_TASK.md
- Append a signed `docs/JOURNAL.md` entry.
