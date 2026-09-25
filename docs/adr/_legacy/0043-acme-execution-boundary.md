# ADR 0043 — ACME execution boundary and Stage 3.5 evaluation

Status: Accepted
Date: 2026-09-15
Task: A008-0114
Amends: ADR 0003 provider boundary; complements ADR 0041 client recovery

## Context

A008 currently owns provider transports directly behind its provider-neutral
`ChatTransport`. The cognitive and memory architecture above that boundary is
already product behavior: model/context selection, semantic retrieval, current
scope, tool selection and approval, agent/orchestration decisions, result
interpretation and all memory lifecycle semantics belong to A008.

Observed provider failures such as an empty terminal answer or a truncated tool
call currently abort an A008 turn and leave limited durable execution evidence.
ACME already has execution identity, model-call reservation, failure ambiguity,
retention and durable resume semantics, making it a candidate execution
substrate before A008 Stage 4 fixes client recovery/idempotency semantics.

ACME's current `acme-runtime/1` `/v1/execute` surface is **not** suitable for
this integration because it invokes the full ACME `ExecutionEngine`, including
ACME domain contracts, memory/state processing and domain commit semantics.
A008 requires a model-only ACME execution surface instead.

## Decision

The architectural invariant is:

> **The ACME integration replaces A008's provider execution path, not any part
> of the A008 cognitive or memory architecture.**
Or more compactly:

```text
A008 decides.
ACME executes.
Providers compute.
```

A008 owns **why, what and when** a model execution exists. ACME may own **how**
one already-authorized, fully prepared execution is carried out.

A008 therefore remains sole authority for:

- memory/knowledge records, evidence lifecycle, activation, decay,
  reinforcement, supersede/extension and provenance;
- domains, related domains, tags, current scope, semantic neighbourhoods,
  retrieval, ranking and context construction;
- system/agent/task instructions and model/profile selection strategy;
- tool selection, user approval, tool execution and tool-loop continuation;
- agent selection, delegation, orchestration, necessity gating and planning;
- interpretation of a model result as application/session/knowledge state.

ACME may receive the already prepared messages/context, selected model,
generation controls, tool schemas and execution policy as opaque
application-owned input. ACME may validate execution shape/capability but may
not enrich, remove or reinterpret those inputs for semantic reasons.

ACME may own provider-execution mechanics such as execution identity,
idempotency, transport, timeout, cancellation, conservative failure
classification, response retention, usage/cost evidence and safe durable
recovery/replay evidence.
ACME MUST NOT execute A008 tools. A tool call returned by a provider is a
normalized execution result; A008's existing `ChatSession` approval/execution
loop decides whether and how it is executed and constructs any later tool-result
continuation.

ACME MUST NOT automatically retry an ambiguous provider execution or repair a
truncated tool call by guessing missing semantic content. A mechanical retry is
permitted only when ACME can prove the previous attempt was not dispatched or a
later explicit architecture decision establishes equivalent duplicate-call
safety.

## Stage 3.5 adoption gate

A008-0114 evaluates ACME beside the current direct transports. The direct path
remains the reference/control implementation during this task; there is no
automatic fallback from ACME to direct transport after dispatch.

ACME becomes A008's normal provider-execution substrate only after deterministic
parity and failure-evidence tests show that equivalent normalized model output
produces equivalent A008 cognitive/session/memory decisions and that ACME adds
useful execution reliability or diagnostics. Default-route adoption is a
separate explicit decision after that evidence; this ADR does not predetermine a
go result.

Stage 4 of A008-0103 does not begin until the Stage 3.5 go/no-go is recorded,
because Stage 4 owns application-level command/turn identity, terminal outcomes,
snapshot/event ordering and reconnect uncertainty, while ACME may own lower-level
provider-execution identity and recovery evidence. These identities and recovery
semantics must remain distinct.

## Documentation truth

This ADR and `PROJECT_BRIEF.md` own the accepted boundary before implementation.
`CURRENT_STATUS.md` may record that evaluation is pending/in progress.
`SYSTEMDOC.md` must describe ACME as the implemented execution path only after an
adapter actually passes Stage 3.5; until then the direct provider path remains
current system behavior.
## Acceptance invariant

The integration is acceptable only when this statement remains true:

> Replacing a direct provider transport with ACME changes how A008 executes a
> model call, but does not change how A008 thinks, remembers, retrieves,
> reinforces, forgets, delegates or decides what to do next.

A before/after run from the same A008 state with equivalent normalized model
output must preserve A008-visible cognitive decisions, apart from explicitly
execution-level diagnostics such as an ACME execution/evidence reference.

## Consequences

- ACME is an infrastructure dependency beneath A008's current cognitive/runtime
  owners, never a second A008 engine.
- A008 application `commandId`/`turnId`/session sequence remain separate from an
  ACME execution/model-call identity.
- ACME stream ordering does not define A008 V2 session event sequencing; A008
  interprets execution events and emits its own application protocol events.
- Direct transports remain useful as Stage-3.5 parity controls even if a later
  task makes ACME the normal path.
- Failure evidence can become more inspectable without turning execution logs
  into semantic memory or provider context.

## References

- `docs/PROJECT_BRIEF.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/CLIENT_API_V2.md`
- ACME ADR 0014 (live provider boundary), ADR 0017 (durable execution resume)
  and ADR 0051 (full external runtime boundary)
