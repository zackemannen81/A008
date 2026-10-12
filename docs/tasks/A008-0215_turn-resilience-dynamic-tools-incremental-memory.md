# A008-0215 — Turn resilience, dynamic tool metadata and incremental memory processing

Task ID: A008-0215
Parent Task: None declared
Status: Ready (Emergency Exception)
Owner: mrWhite / A008
Created: 2026-10-09
Last updated: 2026-10-12
Claimed: Yes — operator-authorized emergency implementation exception
Charter frozen at: 2026-10-12

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/CURRENT_MEMORY_MODEL.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/tasks/A008-0196_bounded-intra-turn-context.md`
- `docs/tasks/A008-0200_bounded-tool-context.md`
- `docs/tasks/A008-0203_permission-replay.md`
- `docs/tasks/A008-0205_transactional-file-editing.md`
- `docs/tasks/A008-0206_embedded-openai-responses-continuation-measurement.md`
- `docs/tasks/A008-0207*`
- `docs/tasks/A008-0213*`

## Emergency Exception and Frozen Hotfix Boundary

The operator has explicitly authorized A008-0215 to bypass the normal waiting
period for the Necessity Gate review, ordinary claim sequencing and dependency
waiting because the current provider/turn failure mode causes repeated paid
runs to be lost. This is a documented exception to process timing, not an
exception to product authority, safety invariants, approval boundaries,
workspace isolation, budget limits, testing, or fail-closed behavior.

The exception authorizes immediate implementation of the smallest urgent slice:
**Milestone 3, failure handling/retry/continue**, beginning with provider
failure classification, bounded retry/backoff, same-run continuation state and
user-visible stop/await-input outcomes. Automatic replay of a tool with unknown
external effect remains forbidden. Milestones 1 and 2 remain frozen in this
charter but may not be implemented by inference or scope expansion; they require
their own measured implementation slices after the hotfix boundary is proven.

Emergency acceptance record:

- Authority: explicit operator instruction in the active task conversation,
  backed by PC-LF-03/04/05/08/09 and the existing continuation/checkpoint
  contracts.
- Necessity: current provider instability wastes paid turns and loses recoverable
  progress; omitting the hotfix permits repeated cost-bearing failures.
- Smallest change: reuse the existing run/session/checkpoint and provider error
  boundaries; add no new provider, memory authority, replay authority or task
  system.
- Required safety: bounded attempts and deadline, no retry after uncertain side
  effects, preserved approval/workspace fences, idempotency/receipt checks where
  available, and explicit user intervention when safety cannot be established.
- Verification: deterministic fault injection first; focused tests, typecheck or
  documented pre-existing blockers, diff review, and sanitized provider fixtures.
  Live calls are not required for the hotfix and remain within the existing
  zero-live-call task budget.
- Governance follow-up: the operator must reconcile the active 0213/0214 task
  records and append the formal task-ID claim on main when the emergency branch
  is integrated. This exception does not authorize push, merge, deployment or
  rewriting a different active charter.


tool-heavy turns: repeatedly sending tool metadata that the model does not need,
and accumulating too much unprocessed turn material before memory work runs.
Provider instability also exposes a separate need for explicit turn failure,
retry, continuation and user-intervention semantics.

This draft defines a bounded investigation and implementation candidate. It does
not claim that the observations are yet measured or that a retry policy is safe
to ship. Existing A008 ownership of context, execution state, approvals,
workspaces, chat history and semantic memory remains authoritative.

## Goal

Reduce avoidable per-turn context and deferred processing pressure while making
provider/tool failures recoverable without unsafe duplicate side effects,
incorrect state, or accidental persistence of transient execution material.

## Primary Deliverable

A measured, tested and provider-compatible turn-resilience slice consisting of:

1. an intraturn tool-metadata projection that exposes only the smallest useful
   tool summary initially and resolves full schemas on demand where supported;
2. an incremental memory-intake pipeline that records turn-local observations,
   processes bounded new batches once, and performs final semantic evaluation and
   commit without reprocessing already settled material;
3. an explicit failure/retry/continue policy with error classification,
   backoff/deadline limits, idempotency and approval/workspace fences, plus a
   clear user-information path for intervention or new input.

The implementation must preserve the existing context envelope, retrieval
semantics, semantic-memory isolation, committed chat history and tool approval
contracts unless a separately approved charter changes them.

## In Scope / Milestones

### Milestone 1 — Dynamic tool metadata

- Measure serialized bytes/tokens for available, exposed and active tool sets
  using real request fixtures and local logs; do not infer token savings from
  schema counts alone.
- Define a compact tool catalog/projection with stable tool identity, short
  purpose, availability and the minimum invocation shape needed for selection.
- Keep full parameter schemas available to the runtime and fetch/expose them only
  when the current step requires that tool, subject to Responses API/tool
  compatibility and existing MCP strictness.
- Bound metadata by the existing context/request budget and fail closed when the
  selected schema cannot fit; never silently truncate a schema into an invalid
  callable tool.
- Preserve runtime visibility of complete tool results for system processing while
  projecting only the model-relevant portion into the next provider request.
- Test that approval, argument validation, tool identity, MCP behavior and
  replay/continuation semantics do not change merely because metadata is compact.

### Milestone 2 — Incremental memory processing

- Separate turn-local collection from durable semantic commit. New observations,
  claims, candidate state changes, provenance and relation candidates receive a
  turn/run identity and remain retrievable for the active turn without becoming
  current durable state prematurely.
- Introduce an explicit processing ledger/state such as `unprocessed`,
  `processing`, `processed`, `needs-revaluation` and `committed`, with one
  canonical owner and idempotent batch boundaries. Exact names remain open until
  repository inspection.
- Process bounded batches during long work only when a concrete threshold or
  checkpoint is reached; do not run a full memory cycle after every tool call.
- Ensure already processed material is not sent through sorter/classifier/
  reconciler/evaluator again unless an explicit dependency or re-evaluation mark
  requires it.
- Preserve a compact turn-local summary sufficient for retry/continue and active
  retrieval, without storing raw provider reasoning or execution-state metadata
  in semantic memory or ordinary committed chat history.
- Finalize remaining material at terminal turn completion, with atomic validation,
  relation classification and commit using the existing memory contract.
- On crash/restart, recover only valid turn-local/checkpoint material and keep
  uncommitted candidates fenced from current state until the normal commit gate.

### Milestone 3 — Failure handling, retry and continuation policy

- Classify failures into at least: safe transient provider/transport failure,
  rate limit/quota, timeout/unknown external effect, invalid request/schema,
  authentication/configuration, approval/workspace violation, cancellation and
  terminal application error.
- Retry only errors explicitly classified as safe and retryable. Rate limits use
  bounded provider-aware delay/backoff and deadline; no busy loop or unbounded
  waiting. Unknown external effects are not automatically replayed.
- Make retry attempts identifiable and bounded by per-turn attempt count,
  deadline, provider budget and an idempotency key where the provider/tool path
  supports it. Tool calls with side effects require a receipt/fence before any
  replay decision.
- Define `stop`, `retry`, `continue` and `await-input` outcomes. `continue` must
  rebuild the same run-local context and may not silently create a new task,
  workspace, approval or semantic-memory namespace.
- Allow a user to supply new information during a paused/await-input turn through
  the existing session boundary. The new message must be clearly associated with
  the interrupted turn and must not be mistaken for provider output or a tool
  result.
- Surface concise diagnostic/status information to the client while keeping
  credentials, raw private payloads and provider reasoning out of user-visible
  logs unless existing diagnostics explicitly allow them.
- Add fault-injection tests for retryable errors, rate limits, malformed responses,
  timeout-after-dispatch, process loss, cancellation, duplicate receipts and
  recovery with/without valid continuation state.

## Out of Scope

- Replacing A008's semantic-memory model, retrieval rules, lifecycle or
  project namespace.
- Sending raw chain-of-thought/reasoning to memory, chat history or the UI.
- Full memory processing after every tool call, background processing without an
  owned durable scheduler, or an unbounded queue.
- Automatic replay of arbitrary side-effecting tools, filesystem edits,
  destructive actions, approvals or external MCP mutations.
- Provider-specific assumptions that are not verified against the actual route;
  KIE/gpt-6-luna observations are discovery input, not authority.
- Changing workspace isolation, task claiming, child-task governance, merge,
  push, deployment or publication policy.
- A new provider, new dependency or live-provider benchmark as a prerequisite
  before local deterministic behavior is proven.
- Moving memory ownership into ACME or any external execution runtime.

## Necessity Gate — Draft Proposal

| Change | Contract authority and accepted constraint | Observable need / omission consequence | Smallest sufficient approach | Planned verification |
| --- | --- | --- | --- | --- |
| Dynamic tool metadata | Core Product Contract clauses governing A008 ownership of context construction, provider-neutral execution and bounded requests; reconcile with A008-0196/A008-0200. | Full schemas for unused tools consume request budget and can crowd out task-relevant context during large turns. | Add a request-local projection and on-demand schema resolution at the existing provider/tool boundary; retain complete runtime catalog. | Fixture byte/token comparison, schema validity tests, Responses/MCP compatibility tests, no behavior change for selected tool calls. |
| Incremental memory processing | Core Product Contract memory ownership/isolation clauses; reconcile with `CURRENT_MEMORY_MODEL.md` and A008-0196–0200. | Deferred material can grow with turn length and make final processing expensive; repeated batches could create the same cost in smaller pieces. | Add bounded, idempotent intake/processing markers around existing pipeline stages; preserve final commit authority. | Batch ledger tests, exactly-once processing assertions, crash/recovery fencing, semantic-memory and committed-history isolation tests. |
| Failure/retry/continue | Existing turn identity, continuation, checkpoint, approval and tool-receipt contracts; reconcile with A008-0203/A008-0206/A008-0213. | A crash currently risks losing progress or unsafe replay; indiscriminate retry risks duplicate side effects and extra provider spend. | Add explicit error classes and bounded policy at the existing turn boundary, reusing receipts/checkpoints rather than inventing a second runtime. | Fault injection, rate-limit backoff, timeout uncertainty, process-loss recovery, cancellation and duplicate-side-effect prevention. |

Before this draft can become Ready, the operator must pin the current contract
revision and resolve any conflict with active/frozen A008-0213 or later task
records. No implementation is authorized by this draft alone.

## Proposed Data Boundaries

- **Available tools:** runtime-owned catalog; not necessarily model-visible.
- **Exposed tools:** compact request-local projection selected for the objective,
  current phase and active step.
- **Active tools:** complete schema and invocation contract for the current
  selection only; validated before dispatch.
- **Turn-local observations:** transient, run/turn scoped, provenance-bearing and
  retrievable for retry/continue; not durable current state.
- **Processed candidates:** ledger-marked material with stable batch identity;
  never reprocessed without an explicit invalidation/re-evaluation reason.
- **Committed knowledge:** only after existing validation, relation/state rules
  and atomic commit succeed.
- **Execution state:** remains separate from semantic memory and committed chat
  history; compact summaries may support continuation but are not knowledge.

## Safety and Policy Invariants

- Retry policy is fail-closed for unknown external effects.
- Rate-limit waits have a deadline and do not bypass task/provider budgets.
- A retry never bypasses approval, workspace, authentication or path guards.
- A continuation never replays a tool solely because it appeared in a checkpoint.
- Full tool results remain runtime-owned; model projection may be narrower but
  must not change system audit or recovery data.
- A turn-local fact cannot become durable current state before the normal commit
  boundary; local files and uncommitted repository state must not be asserted as
  durable facts without the applicable evidence fence.
- No raw provider reasoning is persisted or fed into post-output knowledge
  extraction as a knowledge source.

## Minimum Verification Gates

- [ ] Current contract/active-task reconciliation and pinned authority revision.
- [ ] Baseline measurements for tool metadata bytes/tokens, repeated metadata
      across turns, active-tool ratio and deferred-memory batch size.
- [ ] Deterministic compact-projection and on-demand-schema tests, including
      oversized/invalid schema fail-closed behavior.
- [ ] Deterministic incremental-ledger tests proving bounded batches, no duplicate
      processing, explicit re-evaluation and atomic final commit.
- [ ] Semantic-memory, committed-history and execution-state isolation tests.
- [ ] Fault-injection tests for all retry classes, rate-limit backoff, deadlines,
      unknown external effects, cancellation and process recovery.
- [ ] Root typecheck/build, focused tests and `git diff --check`.
- [ ] Manual review of sanitized provider request fixtures/logs; no live provider
      call required unless a later frozen charter identifies a provider-specific
      compatibility question and resolves its budget.
- [ ] Update `SYSTEMDOC`, `CURRENT_STATUS`, relevant task records and handoff only
      after behavior is implemented and verified.

## Open Decisions Before Ready

1. Which existing request builder owns dynamic tool projection, and what stable
   schema-resolution mechanism is compatible with all supported provider routes?
2. Whether the processing ledger belongs in existing run storage, memory storage
   or a strictly run-local store, without creating a second semantic authority.
3. What concrete threshold triggers an incremental batch, and how batch size is
   bounded by time, bytes, candidate count and provider budget.
4. Which errors are retryable per route, and how provider idempotency/receipts
   prove that a retry cannot duplicate an external effect.
5. Whether `continue` is an automatic same-turn continuation, an explicit user
   action, or both; define the exact terminal and await-input states.
6. How much compact turn summary is useful without leaking execution metadata or
   reasoning into semantic memory.
7. How measurements from KIE logs can be sanitized and reproduced locally without
   committing private payloads or credentials.

## Verification / Status

Emergency exception recorded and charter frozen on 2026-10-12. No product
implementation has been performed yet. The first authorized implementation
slice is Milestone 3 only; Milestones 1–2 remain planned and gated as described
above. The repository still contains an active A008-0213 `CURRENT_TASK.md`; that
record was not overwritten. Formal ID-register reconciliation is a required
integration follow-up owned by the operator.

## Handoff / Follow-up

- Current state: Draft; not claimable/Ready from this file alone.
- Immediate next step: operator reviews scope against current task state and
  decides whether to register/claim A008-0215 or split it into bounded tasks.
- No task ID register, CURRENT_TASK, journal, status or system documentation
  changes are included in this draft.
- No child task, pause, supersede, implementation, commit, push or live-provider
  action was performed.
