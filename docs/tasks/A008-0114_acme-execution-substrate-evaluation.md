# A008-0114 — ACME execution substrate evaluation (Stage 3.5)

Task ID: A008-0114
Parent Task: A008-0103
Status: Ready
Owner: Grok (delegated)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `3532bcd`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/CLIENT_API_V2.md`
- `docs/adr/0043-acme-execution-boundary.md`

## Task Summary

A008 Stage 3 is complete and Stage 4 has not started. Provider-execution failures
such as empty terminal answers and truncated tool calls currently abort an A008
turn and leave limited durable evidence for diagnosis. ACME already demonstrates
strong execution identity, retention and recovery mechanics, but A008 must not
adopt ACME's cognitive/domain runtime.

ACME-0176 is the prerequisite: it must first expose a versioned **model-only**
execution surface supporting text, tools, streaming and durable execution
evidence without ACME domain/memory/state semantics.## Task Charter

### Goal

Evaluate ACME as A008's non-cognitive provider-execution substrate beneath the
existing A008 `ChatTransport` boundary, proving semantic parity and improved
execution evidence before any default-route adoption or Stage-4 recovery work.

### Primary Deliverable

An `AcmeChatTransport` (or equivalent implementation of the existing
`ChatTransport` contract) against ACME-0176's model-only runtime, selectable
explicitly in local composition, plus deterministic direct-vs-ACME parity and
failure-evidence tests and a documented go/no-go adoption decision.

### In Scope

- Map an already-prepared A008 `ChatRequest` to the ACME model-only execution
  protocol. A008 remains owner of model choice, messages/context, generation
  controls, tool definitions and the decision to perform the call.
- Map ACME ordered reasoning/content stream events and terminal completion back
  to existing `ChatCallbacks`, `ChatCompletion` and typed `ChatError` behavior.
- Map normalized ACME tool calls structurally into A008 tool-call data. Tool
  approval, execution, budget and continuation remain in `ChatSession`.
- Send A008-created tool-result continuation as a later bounded ACME model
  execution; ACME never executes or approves the tool.
- Route A008's stateless semantic analyzer/classifier calls through the same
  injected `ChatTransport` when the ACME transport is selected, without moving
  their prompts, parsing or semantic interpretation into ACME.- Add explicit local composition/configuration for choosing the ACME adapter.
  Direct provider transports stay available as Stage-3.5 reference/control paths.
- Do **not** automatically fall back to a direct provider after an ACME dispatch;
  an ambiguous provider outcome may already have executed and been billed.
- Surface safe ACME execution/evidence identity and failure classification in
  A008 diagnostics/errors where useful. Execution evidence is never semantic
  memory, retrieved context or provider-visible application content.
- Preserve A008's credential boundary: provider credentials belong to the ACME
  runtime composition when ACME executes the provider call; they are not sent in
  A008 model content or persisted as A008 project knowledge.
- Build deterministic parity cases for normal text, reasoning stream, tool call,
  tool-result continuation and stateless semantic JSON execution.
- Build deterministic failure cases for empty/no usable answer, truncated tool
  call/stream, mid-stream disconnect, timeout, explicit cancellation, provider
  429/5xx, malformed terminal data and ambiguous delivery evidence.
- Compare direct and ACME paths from equivalent A008 state and normalized model
  output for committed chat, callbacks, tool-request semantics, memory reads,
  semantic proposals/reconciliation and final knowledge state.
- Record a go/no-go result with concrete evidence before A008-0103 Stage 4 starts.

### Out of Scope

- Implementing or modifying ACME-0176; it is an external prerequisite.
- Moving A008 retrieval, current scope, prompts, model selection, orchestration,
  memory lifecycle, relation decisions or result interpretation into ACME.
- Stage-4 `turnId`/`messageId`, A008 event sequence, authoritative snapshots,
  terminal turn protocol, command receipts/idempotency or reconnect/resume.
- Automatic fallback or semantic retry after an ACME execution was dispatched.
- New model/provider selection policy or changes to provider-facing semantics.
- A008 memory/database/schema migrations, Tauri/Expo client implementation,
  deployment or removal of the direct adapters.
### Definition of Done

- ACME-0176 is Complete and publishes/records the model-only protocol this task
  consumes; A008 does not call ACME's full `/v1/execute` task runtime.
- The ACME adapter satisfies the existing A008 `ChatTransport` contract without
  changing `ChatSession` cognitive/tool-loop ownership.
- Direct and ACME paths produce equivalent A008-visible cognitive/session/memory
  outcomes for equivalent normalized model outputs; permitted differences are
  limited to execution-level identity/evidence/diagnostics.
- Fragmented tool calls are never executed until A008 receives one structurally
  complete call and its existing approval path permits execution.
- Failure/cancellation cases leave useful ACME execution evidence while A008
  remains fail-closed and makes no unintended tool or knowledge mutation.
- An A008 cancellation reaches ACME and the provider execution; ambiguous or
  already-dispatched work is never silently replayed through the direct path.
- No A008 memory/knowledge/orchestration module imports ACME implementation
  types. ACME-specific mapping remains at the transport/composition boundary.
- Existing direct provider transports remain usable as reference controls.
- Full A008 verification, protocol-package proof, GUI build and portable-engine
  proof pass with deterministic/local providers only unless separately approved.
- A go/no-go adoption decision is archived. A **go** may authorize a later task
  to make ACME the normal route; a **no-go** leaves current provider execution
  authoritative and Stage 4 proceeds without ACME.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3532bcd`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| ACME `ChatTransport` adapter | PC-01, PC-05 + ADR 0043 | Test whether provider execution can gain ACME reliability/evidence without a second A008 engine; omission leaves the question untested before Stage 4. | One adapter beneath existing `ChatTransport`; no cognition moved. | Direct-vs-ACME deterministic parity suite. |
| Preserve cognitive/memory semantics | PC-02, PC-03, PC-04 + ADR 0043 | ACME integration must not alter retrieval, context, reconciliation or lifecycle; otherwise it changes product behavior instead of execution substrate. | Treat ACME as opaque execution only and compare final A008 state. | Byte/semantic-equivalence fixtures across chat and memory flows. |
| Failure evidence and cancellation | PC-05 + ADR 0043 | Current provider failures can discard a turn with weak diagnostics; unsafe fallback may duplicate dispatched work. | Map ACME typed failure/evidence and propagate AbortSignal; no post-dispatch fallback. | Failure matrix including truncated stream, timeout, cancel and ambiguity. |
| Stage-3.5 gate before Stage 4 | PC-01, PC-05 + ADR 0041/0043 | Stage 4 could otherwise duplicate or conflate provider execution recovery with application turn/reconnect semantics. | Record go/no-go before Stage 4; keep identities separate. | Review task archive against A008-0103 Stage-4 scope. |
### Minimum Verification Gates

- [ ] ACME-0176 protocol compatibility/descriptor is checked before execution;
  unexpected model-runtime versions fail before a provider call.
- [ ] Existing `ChatTransport` behavior passes through the ACME adapter for text,
  reasoning deltas, usage/finish metadata, tools and tool-result continuation.
- [ ] Direct-vs-ACME fixtures produce equivalent committed chat and memory state
  from the same A008 inputs and equivalent normalized provider outputs.
- [ ] Empty answer, truncated tool stream, network interruption, timeout, cancel,
  429/5xx, malformed result and ambiguous-delivery cases are deterministic and
  preserve useful execution evidence without unintended side effects.
- [ ] No automatic direct-provider fallback occurs after ACME dispatch.
- [ ] Dependency/boundary review proves ACME imports are confined to the
  execution adapter/composition and do not enter memory/knowledge/orchestration.
- [ ] Full `npm test`, `npm run verify:protocol`, production GUI build, portable
  engine proof and `git diff --check` pass.
- [ ] No live provider call, deployment or Tauri/Expo modification is required.
- [ ] Go/no-go is recorded before Stage 4 is activated.

## References

- `docs/adr/0043-acme-execution-boundary.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/CLIENT_API_V2.md`
- `src/core/types.ts`
- `src/core/chat-session.ts`
- `src/orchestration/semantic-json-model.ts`
- ACME task ACME-0176 and its completed handoff/protocol are prerequisites.

## Checklist

- [ ] Wait for ACME-0176 completion; inspect its model-only protocol and evidence
  semantics before writing the A008 adapter.
- [ ] Add ACME protocol client/adapter at the existing execution boundary.
- [ ] Wire explicit local composition/configuration without changing the default.
- [ ] Add text/reasoning/tool/semantic parity fixtures.
- [ ] Add failure/evidence/cancellation/no-fallback fixtures.
- [ ] Run boundary review and full A008 verification.
- [ ] Record go/no-go and update owning docs without starting Stage 4.
## Decisions and Notes

- The immutable boundary is ADR 0043: A008 decides; ACME executes; providers
  compute. A008 owns why/what/when; ACME may own how one prepared call runs.
- ACME's full task endpoint `/v1/execute` is forbidden for this integration.
  Only ACME-0176's model-only runtime is eligible.
- A008 `commandId`/`turnId`/session sequence and ACME execution/model-call IDs are
  separate identities with separate authority.
- ACME stream event ordering does not become the A008 V2 event sequence.
- The task evaluates the adapter; it does not silently switch the product default.
- `SYSTEMDOC.md` must not claim ACME as current execution behavior until an
  implemented adapter passes this task. If evaluation is no-go and the adapter is
  removed/non-authoritative, SYSTEMDOC remains on the direct path.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual diff against ADR 0043 and every Necessity Gate row.
- [ ] Record ACME-0176 protocol/build identity used for the proof.
- [ ] Record exact parity and failure-matrix results.
- [ ] Record final full-suite/package/build/portable-engine results.
- [ ] Record the adoption decision and skipped checks/reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md` only for behavior that actually exists at completion
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] `docs/tasks/A008-0103_stable-client-api-program.md`
- [ ] ADR/index only if implementation reveals a real decision conflict

## Handoff and Follow-ups

- Current state: chartered; no A008 ACME adapter exists yet.
- Next recommended step: complete ACME-0176, then implement this adapter/proof.
- Blockers: ACME-0176 model-only runtime contract.
- Child tasks: only if a prerequisite blocks this frozen deliverable.
- Resume condition: ACME-0176 is Complete with a versioned consumable protocol.
- Open questions: go/no-go and default-route adoption are evidence outcomes, not
  assumptions to resolve before implementation.

## Finalize When Complete

- Archive under `docs/finished/A008-0114_*.md`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from the template.
- Write `docs/handoffs/A008-0114.md` and append the signed journal entry on merge.
