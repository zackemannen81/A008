# A008-0140 — Stage 4 restart uncertainty and closure proof

Task ID: A008-0140
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
- `docs/tasks/A008-0139_stage4-reconnect-resume-lease.md`

## Task Summary

A008-0132, A008-0138 and A008-0139 establish the individual Stage-4 identity/order, command-idempotency and same-process resume guarantees. The final Stage-4 child proves the boundary across process restart and the combined race matrix, surfacing uncertainty instead of pretending lost process-local state failed safely.

## Task Charter

### Goal

Close Stage 4 by making process-loss uncertainty explicit and proving the combined turn/event/receipt/resume contract against restart, cancellation, approval, partial-memory and multi-session/project races.

### Primary Deliverable

Verified restart/unknown-outcome behavior plus a real-host Stage-4 closure matrix that allows A008-0103 Stage 4 to be marked Complete without introducing durable-session or exactly-once claims.

### In Scope

- Prove a server restart changes `serverInstanceId` and invalidates process-local resume authority.
- Running/expired/lost process-local command receipts after restart surface explicit unknown outcome; no automatic mutation resubmission.
- Clients can distinguish known terminal receipt/outcome from `COMMAND_UNKNOWN`/missing process-local state.
- Active turn/process loss is represented as interrupted/unknown according to observable evidence; no fabricated completion.
- Answer completion and post-output memory outcome remain independently truthful, including partial/unreported memory settlement.
- Cancellation during approval/provider/tool boundaries cannot emit duplicate terminal outcomes or claim rollback of completed side effects.
- Multi-project/multi-session concurrency retains independent sequence, receipt and authority state.
- Run the accepted Stage-4 real-host race matrix: duplicate commands, snapshot/event interleaving, late/stale events, cancellation during approval, lease expiry, server restart and partial memory outcomes.
- Update V2 discovery/docs/program status to advertise only verified completed Stage-4 capabilities.

### Out of Scope

- Durable conversation/session/receipt persistence across restart.
- Offline sync, mobile background-run survival or simultaneous writers.
- Stage-5 SDK/web migration, Stage-6 native proof or Stage-7 compatibility release.
- Provider/model routing, semantic-memory redesign or database migration.
- General exactly-once execution.

### Definition of Done

- Restart invalidates old resume authority and produces a new server instance identity.
- Unknown/lost process-local command state is surfaced as uncertainty and never auto-resubmitted.
- Combined Stage-4 races do not duplicate turns, tools, approvals or terminal outcomes.
- Snapshot/event ordering remains correct through detach/resume/late-event scenarios.
- Partial answer/memory outcomes are represented without inventing persistence success.
- Independent projects/sessions remain isolated under concurrent recovery scenarios.
- All Stage-4 acceptance cases in `CLIENT_API_V2.md`/A008-0103 are covered by named evidence.
- A008-0103 Stage 4 can truthfully move to Complete; Stage 5 becomes the next gate.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01/04/05/06.
Contract revision: `b8f5a557b498c02514ceb8e90d0a69783cc78eed`.
Accepted constraints: ADR 0041 decisions 5/8 and required evidence; `CLIENT_API_V2.md` Command receipts and uncertainty + Implementation and release gates; A008-0103 Stage 4.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Restart uncertainty semantics | PC-01/04/05; no durable-session promise | Client could treat lost process-local state as confirmed failure/success and retry unsafely | Explicit instance change + unknown outcome handling around existing owners | real process restart with old receipt/resume artifacts |
| Combined race proof | PC-04/05/06; ADR 0041 required evidence | Individually passing slices could still violate authority/side-effect guarantees when interleaved | Focused real-host matrix over existing Stage-4 mechanisms | duplicate/snapshot/cancel/lease/restart/memory race suite |
| Stage-4 capability closure | PC-01; truthful versioned client contract | Stage 5 could consume an incompletely advertised backend guarantee | Update discovery/program/docs only after evidence passes | capability/status and docs truth review |

### Minimum Verification Gates

- [ ] Real process restart changes server instance and invalidates old resume capability.
- [ ] Lost/expired receipt after restart returns explicit unknown outcome; no automatic resubmission.
- [ ] Cancellation during approval/provider/tool boundary produces at most one terminal outcome and does not undo completed side effects by claim.
- [ ] Partial/unreported post-output memory outcome remains distinct from answer completion.
- [ ] Concurrent multi-project/multi-session recovery retains authority/sequence/receipt isolation.
- [ ] Full Stage-4 real-host matrix covers duplicate commands, snapshot interleaving, late events, lease expiry and restart.
- [ ] V1/ACP plus full root/protocol/package verification remain green.
- [ ] Discovery/docs advertise completed Stage-4 capabilities only after gates pass.
- [ ] No live/paid provider call is required.

## References

- `docs/CLIENT_API_V2.md`
- `docs/backlog/host-client-api-boundary.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/tasks/A008-0138_stage4-command-receipts-idempotency.md`
- `docs/tasks/A008-0139_stage4-reconnect-resume-lease.md`

## Checklist

- [x] Identity claimed on main.
- [x] Charter frozen Ready after claim landed on main.
- [ ] Confirm A008-0138 and A008-0139 are Complete on integration main before implementation.
- [ ] Implement/verify restart uncertainty behavior.
- [ ] Run combined Stage-4 real-host closure matrix.
- [ ] Update discovery and mark A008-0103 Stage 4 Complete only if all gates pass.
- [ ] Run full verification and update owning docs.
- [ ] Archive/handoff/restore CURRENT_TASK before push.

## Decisions and Notes

- Implementation is sequential: do not start until A008-0138 and A008-0139 are both integrated Complete.
- This child proves bounded process-local semantics; it must not add persistence merely to make restart appear seamless.
- Stage 4 completion authorizes Stage 5 to begin; it does not itself migrate any client.
- A worker must branch from then-current main and revalidate this frozen charter before implementation.

## Charter Amendment Log

- none

## Verification

- pending implementation; prerequisites A008-0138 and A008-0139 not yet complete

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/CLIENT_AUTH.md` / `docs/CLIENT_API_V2.md` as needed
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] `docs/tasks/A008-0103_stable-client-api-program.md` — Stage 4 -> Complete only after all gates pass
- [ ] archive + handoff; journal on merge

## Handoff and Follow-ups

- Current state: Ready but dependency-blocked by A008-0138/A008-0139.
- Next recommended step: execute only after both prerequisite children are Complete.
- Blockers: A008-0138 and A008-0139.
- Child tasks: none.
- Resume condition: prerequisites complete and accepted contract unchanged.
- Open questions: none.
