# A008-0138 — Stage 4 command receipts and bounded idempotency

Task ID: A008-0138
Parent Task: A008-0103
Status: Complete
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
- `docs/finished/A008-0132_stage4-turn-recovery-foundation.md`

## Task Summary

A008-0132 gives V2 stable application turn/message identity, ordered events/snapshots and terminal outcomes, but a transport retry can still repeat a mutation because V2 has no command receipt owner. This child adds the bounded process-local command identity/receipt guarantee accepted for Stage 4 before reconnect/resume is layered on top.

## Task Charter

### Goal

Make covered V2 mutations safely identifiable and repeat-observable within one running server instance so identical retries do not duplicate turns, approvals, provider work or tool side effects.

### Primary Deliverable

A shared V2 command/receipt contract and host-owned process-local receipt registry keyed by authorized principal and stable `commandId`, with canonical payload matching, bounded retention and explicit unknown/conflict outcomes.

### In Scope

- Stable application `commandId`, distinct from `turnId`, for V2 session mutations.
- Canonical payload digest including action, project, session and semantically relevant mutation payload.
- One host-owned `(principal, commandId)` receipt entry with running and terminal observable state.
- Same ID + same canonical payload observes the existing running/terminal receipt and must not repeat the underlying mutation.
- Same ID + changed canonical payload fails with an explicit conflict outcome.
- Receipt lookup uses the same principal/project/session authority as the originating operation.
- Duplicate prompt/control/cancel/tool-permission attempts cannot create duplicate turns, approval resolution, provider execution or tool execution.
- Completed receipt retention: five minutes from settlement, bounded to 1,024 entries per principal.
- Running or unexpired receipts are never evicted to admit another mutation; capacity exhaustion is explicit.
- Expired or unknown receipts return `COMMAND_UNKNOWN`.
- Receipt data and errors remain secret-safe; credential values are never retained in receipt payloads.
- Discovery/schema/docs updates required to expose only the guarantee actually implemented.

### Out of Scope

- Reconnect/resume capability and 45-second detached-session lease; A008-0139.
- Server-restart recovery/uncertainty closure; A008-0140.
- Durable receipts, durable exactly-once execution, cross-process receipt persistence or automatic retry after uncertainty.
- Event replay/history, durable conversation, offline sync or multiple simultaneous writers.
- Stage-5 SDK/web migration or client-side retry policy beyond protocol fixtures.
- Expanding unrelated HTTP job/upload retry semantics unless required by an existing covered V2 mutation.

### Definition of Done

- Covered V2 mutations carry stable `commandId` and produce/resolve authorized receipts.
- Repeating the same command ID/payload while running or retained returns the existing receipt without re-execution.
- Reusing an ID with different canonical content fails deterministically.
- Prompt and permission duplicates cannot create duplicate turn/provider/tool effects.
- Running/unexpired receipts survive capacity pressure; settled receipts expire by the accepted retention rule.
- Expired/unknown lookup reports uncertainty as `COMMAND_UNKNOWN`, never inferred failure or implicit resubmission.
- Existing A008-0132 identity/event/snapshot/terminal semantics and V1/ACP behavior remain regression-clean.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01/04/05/06.
Contract revision: `b8f5a557b498c02514ceb8e90d0a69783cc78eed`.
Accepted constraints: ADR 0041 decisions 5 and 8; `CLIENT_API_V2.md` Command receipts and uncertainty; A008-0103 Stage 4.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Stable command identity + canonical digest | PC-01/04/05; ADR 0041 D5/D8 | Transport retry can create a second mutation because turn/socket identity is not mutation identity | Add command ID and deterministic digest at the existing V2 session owner | same-ID same/different-payload real-host regressions |
| Process-local receipt owner | PC-04/05; CLIENT_API_V2 receipt contract | Client cannot distinguish running/settled/unknown work safely | Bounded in-memory registry keyed by authorized principal + command ID | running/terminal lookup, auth isolation, retention/capacity tests |
| Duplicate side-effect suppression | PC-05/06; tool/session authority remains backend-owned | Retry can duplicate model/tool/approval effects | Route covered mutations through the receipt owner before side effects | prompt/tool-permission duplicate-effect counters |
| Explicit uncertainty | PC-01/04; no invented success/failure | Expired/unknown command could be silently retried or misreported | `COMMAND_UNKNOWN` after retention/process loss; no auto-resubmit | expiry/unknown fixture and error contract |

### Minimum Verification Gates

- [x] Shared protocol/schema round trips for command IDs, receipts, conflict/capacity/unknown outcomes.
- [x] Real-host same-ID/same-payload retry proves one mutation/turn only.
- [x] Real-host same-ID/different-payload retry returns conflict.
- [x] Duplicate permission resolution cannot execute a tool twice.
- [x] Running and retained terminal receipt lookup obeys original authority.
- [x] Five-minute / 1,024-per-principal policy is deterministically testable without wall-clock sleeps.
- [x] Capacity never evicts running or unexpired receipts.
- [x] Secret-redaction review covers receipt/error output.
- [x] Existing A008-0132 focused tests plus full root/protocol gates remain green.
- [x] No live/paid provider call is required.

## References

- `docs/CLIENT_API_V2.md`
- `docs/backlog/host-client-api-boundary.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/finished/A008-0132_stage4-turn-recovery-foundation.md`

## Checklist

- [x] Identity claimed on main.
- [x] Charter frozen Ready after claim landed on main.
- [x] Implement shared command/receipt contract.
- [x] Implement host-owned bounded receipt registry.
- [x] Route covered V2 mutations through receipt semantics.
- [x] Add focused real-host/idempotency regressions.
- [x] Run full verification and update owning docs.
- [x] Archive/handoff/restore CURRENT_TASK before push.

## Decisions and Notes

- The guarantee is deliberately process-local and bounded. It is not durable exactly-once execution.
- `commandId`, `turnId`, `sessionId`, `connectionId`, `serverInstanceId` and ACME `modelExecutionId` remain distinct identities.
- Receipt retention begins at settlement; running work remains identifiable until settlement or process loss.
- Implementation branched from `4b23158`; the pinned Core Product Contract and accepted ADR/V2 boundary remained compatible. No charter amendment was required.

## Charter Amendment Log

- none

## Verification

- Focused receipt/V2 gate: 19/19 passed, including same-command running/terminal dedupe, changed-payload conflict, repeated failed-command replay, tool-permission dedupe and authenticated/foreign-principal lookup.
- Deterministic store tests cover canonical digest identity, principal isolation, five-minute terminal expiry and capacity behavior without wall-clock sleeps.
- Full `npm test`: 677 core + 4 membership + 176 GUI = 857 passed, 0 failed, 0 skipped.
- `npm run typecheck`: passed.
- GUI typecheck and full 176-test GUI suite: passed.
- `npm run verify:protocol`: packed `@a008/protocol` and packed dependency installed offline outside A008; independent TypeScript consumer compiled and ran with the new command/receipt contract and lookup route.
- Generated protocol artifacts are limited to the V2 command/receipt/info/error/session surfaces whose semantics changed; unrelated V1 generator-format churn was removed.
- Receipt records store digest and bounded metadata only, never the raw prompt/tool mutation payload. Dynamic project-binding detail is normalized before it can become receipt error text; existing V2 WebSocket credential redaction remains in place.
- `git diff --check`: passed before closure.
- No live or paid provider call was required or performed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/CLIENT_API_V2.md` implementation status
- [x] `docs/CLIENT_AUTH.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `README.md`
- [x] `docs/tasks/A008-0103_stable-client-api-program.md`
- [x] archive + handoff; journal remains the operator merge entry

## Handoff and Follow-ups

- Current state: Complete and verified on `chatGPT/A008-0138-command-receipts-idempotency`; ready for PR/integration.
- Next recommended step: after A008-0138 integrates Complete on main, activate A008-0139 reconnect/resume lease.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.
