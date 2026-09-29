# ADR 0057 — Checkpointed unfinished-turn recovery

Status: Accepted
Date: 2026-09-30
Decision owner: Rickard (Task 4 implementation request)
Task: A008-0199

## Authority and decision

PC-LF-05/07/08/09 and ADR 0055 preserve accepted work and durable identities
while forbidding implicit replay of interrupted operations. An opt-in Task 3
checkpoint at a completed tool boundary may therefore seed a replacement
process's next model request, provided no subsequent effect could have started.
This advances unfinished work; it never executes stored tool calls.

The existing PlatformStore owns a recovery supplement bound to the checkpoint:
recent raw rounds, consumed tool identities, runtime sequence/route and workspace
evidence. A synchronized durable fence invalidates older recovery eligibility
before tool dispatch or final completion. Recovery consumes eligibility while
claiming a new lease through the existing coordinator. Stale owners cannot
save recovery state or clear fences. Cancellation, explicit process stop and
host shutdown invalidate eligibility. Old checkpoints without supplements
remain inspectable but cannot authorize continuation.

HEAD, branch, index and tracked/nonignored working files plus explicitly referenced local
artifacts must remain verifiable and unchanged. Opaque effects, unsupported file
kinds, scan limits or changed evidence leave needs_reconciliation with an explicit
reason. Stored findings describe the checkpoint boundary, not verified current
workspace state after a failed comparison. No filesystem transaction or guarantee
against concurrent external mutation after comparison is claimed.

Recovery keeps the durable run/session/workspace and runtime turn identities,
preserves cumulative tool budgets/duplicate protection and remeasures the full
request on the same selected route. Current memory context is obtained through
the existing owner; checkpoints never enter semantic memory. Normal extraction
runs only after the resumed turn completes.

## Consequences and exclusions

A process can recover from the verified checkpoint window. A crash after another
tool starts, an unverifiable external effect, explicit cancellation or an absent
workspace remains conservative reconciliation. This is deliberately not universal
crash recovery or exactly-once external execution. No client API, second scheduler,
implicit tool replay, retention change or automatic publication is introduced.

## Verification

A008-0199 owns real-process continuity and negative-path fixtures, including a
100+ tool-round run across compaction and replacement. Implementation evidence
belongs in its archive and CURRENT_STATUS, not this decision.
