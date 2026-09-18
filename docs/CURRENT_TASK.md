# A008-0132 — Stage 4 turn identity and ordered snapshot foundation

Task ID: A008-0132
Parent Task: A008-0103
Status: Ready
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; task-ID claim merged via PR #70

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/backlog/host-client-api-boundary.md`
- `docs/CLIENT_API_V2.md`
- `docs/adr/0040-stable-client-api-program.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`
- `docs/adr/0043-acme-execution-boundary.md`
- `docs/finished/A008-0112_v2-session-transport.md`

## Task Summary

Stages 1–3 of A008-0103 are complete and Stage 3.5 is GO. V2 already authenticates and binds one writer to one project/session, but it deliberately does not promise stable application turn/message identity, monotonic event ordering, a race-free snapshot boundary or explicit terminal turn outcomes. Stage 4 starts by establishing those invariants before idempotency receipts and reconnect/resume are layered on top.

Project/session ownership is not redesigned here. Stage 2 remains authoritative. This child proves that the existing owner remains correct across multiple independent projects/sessions when ordered application state is added.

## Task Charter

### Goal

Give V2 one authoritative application-level turn/state timeline per session so clients can replace state from a snapshot, discard stale events and distinguish answer completion from terminal turn/memory outcomes without depending on socket order, array position or ACME execution identity.

### Primary Deliverable

A shared V2 contract and host implementation in which accepted prompts have stable A008 turn IDs, committed messages have stable message IDs, application events carry monotonic per-session sequence, snapshots declare the sequence they represent, and each turn settles exactly once with an explicit terminal outcome.

### In Scope

- Stable A008 `turnId` for every accepted prompt.
- Stable `messageId` for committed user/assistant messages; reset/undo retire IDs rather than renumber survivors.
- `serverInstanceId` plus monotonically increasing application `sequence` scoped to server-instance/session.
- Event envelopes carrying `sessionId`, applicable `turnId`, `sequence`, and event kind.
- Authoritative snapshot carrying the exact sequence it represents.
- One ordered subscribe/capture/send/drain boundary with no event-loss gap between snapshot and subsequent events.
- Explicit terminal turn outcomes: `completed`, `cancelled`, `interrupted`, `failed`.
- Separate observable answer completion and post-output memory status.
- Existing one-writer/one-active-turn session policy preserved.
- Multi-session and multi-project isolation regressions proving independent sequences/state.
- Application IDs remain distinct from ACME `modelExecutionId`.

### Out of Scope

- Command receipts/idempotency retention and duplicate mutation replay handling; next Stage-4 child.
- Reconnect/resume capability, 45-second lease, late-event recovery and server-restart uncertainty; later Stage-4 child.
- Durable conversation across host restart, offline sync or background-run survival.
- Multiple simultaneous writers to one session.
- Event replay/history service; this phase requires snapshots plus live subsequent events only.
- Storing/replaying thought streams.
- Changes to ACME provider execution identity, model routing, memory semantics or project ownership.
- SDK/web migration (Stage 5), Expo proof (Stage 6), compatibility release (Stage 7).

### Definition of Done

- Shared protocol schemas/types expose stable turn/message IDs, event sequence/server instance and terminal outcomes.
- Host accepts a prompt once and exposes one stable A008 turn identity through its lifetime.
- Snapshot sequence + event delivery proves no lost or duplicated state across subscribe/capture boundary.
- Old/duplicate events can be deterministically discarded by sequence.
- Every accepted turn reaches exactly one terminal outcome even across cancel/tool-permission paths.
- Answer status and memory status are independently represented.
- Two projects and multiple sessions execute independently without cross-session sequence/state leakage.
- V1/ACP compatibility remains regression-clean.
- No application identity is derived from or aliased to ACME model execution IDs.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01/04/05/06.
Accepted constraints: ADR 0040 program staging; ADR 0041 D5/D8; CLIENT_API_V2 sessions/turns/events/snapshots; ADR 0043 execution identity separation.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Stable turn/message identity | ADR 0041 D5/D8; CLIENT_API_V2 | Clients cannot correlate optimistic state, late events or committed messages safely | branded application IDs at the shared V2/session owner | prompt/cancel/reset/undo identity regressions |
| Monotonic event sequence | CLIENT_API_V2 events | socket arrival order remains an implicit correctness dependency | per-server-instance/session sequence owned by host | delayed/duplicate/out-of-order event fixture |
| Snapshot boundary | CLIENT_API_V2 subscribe/capture/response/drain | event can be lost between reading state and subscribing | one ordered server operation capturing snapshot+sequence before draining later events | forced interleaving regression |
| Terminal outcomes | ADR 0041 D8 | clients cannot distinguish completion, cancellation, interruption and failure or memory uncertainty | explicit terminal state emitted exactly once | cancel/fail/tool-permission/post-output cases |
| Multi-session/project isolation | Stage 2 authority + Stage 4 verification | sequencing could accidentally become global/cross-project | no new owner; prove current registry isolation under ordered events | concurrent two-project/multi-session test |

### Minimum Verification Gates

- [ ] Shared protocol schema/type round trips for IDs, sequence, snapshot and terminal outcomes.
- [ ] Real-host V2 test proves snapshot/event no-gap ordering under forced interleaving.
- [ ] Duplicate/late event fixture proves deterministic discard semantics.
- [ ] Exactly-one terminal outcome across completed/cancelled/interrupted/failed cases.
- [ ] Answer completion vs post-output memory outcome represented independently.
- [ ] Tool-permission/cancel race cannot emit two terminal outcomes or execute stale approval.
- [ ] Two projects and multiple sessions keep independent state/sequence and reject wrong pairing.
- [ ] Existing V1/ACP session behavior remains green.
- [ ] Protocol verification, root typecheck/build and diff hygiene pass.
- [ ] No paid/live provider call required for this child.

## Stage 4 Follow-up Slices

These are already accepted by A008-0103/ADR 0041 but remain separate bounded children after A008-0132:

1. Command receipts and bounded idempotency: stable `commandId`, canonical payload digest, same-ID replay, changed-payload conflict, running/terminal receipt lookup, five-minute/1024-per-principal retention and `COMMAND_UNKNOWN` uncertainty.
2. Reconnect/resume and lease: detached vs closed, opaque same-principal resume capability, initial 45-second lease, late-event handling, approval reset, lease expiry and no automatic command replay.
3. Restart/uncertainty and Stage-4 closure proof: server-instance change, interrupted/unknown work, partial post-output memory outcome, cancellation side-effect limits, multi-session/project concurrency and real-host race matrix.

## References

- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/backlog/host-client-api-boundary.md`
- `docs/CLIENT_API_V2.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`
- `docs/adr/0043-acme-execution-boundary.md`

## Checklist

- [x] Draft bounded first Stage-4 child.
- [x] Merge task-ID claim to main.
- [x] Freeze Draft -> Ready on a fresh implementation branch from main.
- [ ] Implement identities/events/snapshot boundary/terminal outcomes.
- [ ] Run bounded verification.
- [ ] Update A008-0103 observed progress.
- [ ] Archive/handoff and restore CURRENT_TASK.

## Decisions and Notes

- Multi-project/multi-session ownership already exists from Stage 2. Stage 4 tests it under recovery semantics; it does not create a second owner.
- `connectionId`, `sessionId`, `turnId`, `commandId`, `messageId`, `serverInstanceId` and ACME `modelExecutionId` are distinct identities.
- Thought streams remain transient and absent from snapshots, memory and replay/receipt state.
- No exactly-once claim is made by this child or Stage 4.

## Charter Amendment Log

- none

## Verification

- Task-ID claim merged to `main` via PR #70.
- Charter frozen Ready on fresh implementation branch `chatGPT/A008-0132-stage4-turn-recovery-foundation` from updated `main`.
- Product implementation has not begun yet.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] A008-0103 Stage-4 progress row

## Handoff and Follow-ups

- Current state: Ready; charter frozen on implementation branch.
- Next recommended step: implement stable turn/message identity and the ordered event/snapshot foundation.
- Blockers: none.
- Child tasks: none allocated yet; follow-up Stage-4 slices are listed above without IDs.
- Resume condition: claim merged.
- Open questions: none.

## Finalize When Complete

- Archive under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from template.
- Append signed journal entry.