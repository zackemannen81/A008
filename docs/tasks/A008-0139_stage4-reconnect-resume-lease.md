# A008-0139 — Stage 4 reconnect/resume lease

Task ID: A008-0139
Parent Task: A008-0103
Status: Ready
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: 2026-09-19; contract revision `b8f5a557b498c02514ceb8e90d0a69783cc78eed`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CLIENT_API_V2.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/tasks/A008-0138_stage4-command-receipts-idempotency.md`

## Task Summary

After command uncertainty is bounded by A008-0138, Stage 4 still needs a transport-loss policy that distinguishes a detached surviving session from an explicitly closed or expired one. This child implements the accepted same-process 45-second resume lease without promising durable/background execution.

## Task Charter

### Goal

Allow the same authorized principal to reattach to surviving V2 session state during a bounded lease after transport loss while preventing stale writers, stale approvals and implicit work replay.

### Primary Deliverable

A host-owned V2 detach/resume lifecycle with opaque scoped resume capability, initial 45-second lease, authoritative resume snapshot and explicit expiry/close/conflict outcomes.

### In Scope

- Distinguish connection loss/detach from explicit session close.
- On detach, abort active work and deny pending permissions before starting the lease.
- Issue/validate an opaque resume capability bound to the same authorized principal, project and session.
- Initial lease is 45 seconds and remains process-local.
- Resume within lease reattaches surviving session state and returns an authoritative ordered snapshot compatible with A008-0132 sequencing.
- Already-attached sessions reject a second writer.
- Wrong principal/project/session/capability, expired lease and explicit close fail deterministically.
- Lease expiry destroys resume authority and releases the detachable session according to existing owner semantics.
- No reconnect regenerates an answer, replays transient thought, reruns a tool or resurrects an approval.
- Resume capability is kept out of URLs, logs, model/provider payloads and ordinary snapshot data.
- Discovery/docs expose the guarantee only after it is verified.

### Out of Scope

- Server-restart survival or uncertainty semantics; A008-0140.
- Durable sessions/conversation history, offline sync, mobile background-run survival or multi-writer sessions.
- Event replay/history; resume uses authoritative snapshot plus later events.
- Stage-5 SDK/platform adapter implementation.
- Changing the existing V1 45-second reconnect behavior except where shared tests must prove non-regression.

### Definition of Done

- Transport loss produces a detached resumable session only after active work/permissions are settled according to policy.
- Correct same-principal resume within 45 seconds reattaches once and yields authoritative current snapshot/sequence.
- Wrong identity/capability, second writer, expiry and explicit close cannot attach.
- Lost transient output is not replayed and no model/tool mutation is automatically rerun.
- Pending approvals from the detached turn cannot become valid after resume.
- V1/ACP and A008-0132/0138 behavior remain regression-clean.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01/04/05/06.
Contract revision: `b8f5a557b498c02514ceb8e90d0a69783cc78eed`.
Accepted constraints: ADR 0041 decisions 5/7/8; `CLIENT_API_V2.md` Sessions, turns, events and snapshots; A008-0103 Stage 4.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Detach vs close + lease | PC-01/04; ADR 0041 D5 | Socket loss otherwise destroys or ambiguously owns surviving session state | Add bounded detached state to existing session owner, not a second runtime owner | disconnect/resume/close/expiry real-host matrix |
| Scoped resume capability | PC-04/05; ADR 0041 D7 | Session ID alone would become bearer authority | Opaque principal/project/session-bound capability | wrong principal/project/session/capability tests |
| Ordered resume snapshot | PC-01/04; A008-0132 | Client could combine stale pre-disconnect state with new events incorrectly | Reuse authoritative snapshot/sequence boundary on reattach | forced events-around-resume regression |
| No mutation replay | PC-05/06; ADR 0041 D8 | Reconnect could duplicate provider/tool effects | Resume state only; never auto-resubmit commands or approvals | effect counters + stale permission checks |

### Minimum Verification Gates

- [ ] Real-host disconnect produces detached state and cancels active work/denies pending approval.
- [ ] Same-principal/project/session/capability resume within lease succeeds once.
- [ ] Wrong principal/project/session/capability and second writer fail.
- [ ] Deterministic 45-second expiry and explicit close invalidate resume authority.
- [ ] Resume returns authoritative snapshot/sequence and only later events are applied.
- [ ] No thought replay, model regeneration, command replay or tool re-execution occurs.
- [ ] Resume capability is absent from logs/snapshots/provider payloads.
- [ ] Existing V1 reconnect semantics and full root/protocol gates remain green.
- [ ] No live/paid provider call is required.

## References

- `docs/CLIENT_API_V2.md`
- `docs/backlog/host-client-api-boundary.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/tasks/A008-0138_stage4-command-receipts-idempotency.md`

## Checklist

- [x] Identity claimed on main.
- [x] Charter frozen Ready after claim landed on main.
- [ ] Confirm A008-0138 is Complete on integration main before implementation.
- [ ] Implement detach/resume lifecycle and opaque capability.
- [ ] Add lease/authority/snapshot/no-replay regressions.
- [ ] Run full verification and update owning docs.
- [ ] Archive/handoff/restore CURRENT_TASK before push.

## Decisions and Notes

- Implementation is sequential: do not start until A008-0138 is integrated Complete.
- The lease preserves process-local session state, not active computation.
- Explicit close, lease expiry and process restart destroy resume authority.
- A worker must branch from the then-current main and revalidate this charter before work.

## Charter Amendment Log

- none

## Verification

- pending implementation; prerequisite A008-0138 not yet complete

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/CLIENT_AUTH.md` / `docs/CLIENT_API_V2.md` as implemented surface requires
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] `docs/tasks/A008-0103_stable-client-api-program.md`
- [ ] archive + handoff; journal on merge

## Handoff and Follow-ups

- Current state: Ready but dependency-blocked by A008-0138.
- Next recommended step: wait for A008-0138 integration, then implement this child.
- Blockers: A008-0138 must be Complete on main.
- Child tasks: none.
- Resume condition: prerequisite complete and accepted contract unchanged.
- Open questions: none.
