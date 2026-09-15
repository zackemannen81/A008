# A008-0112 â€” V2 session transport and authority

Task ID: A008-0112
Parent Task: A008-0103
Status: Complete
Owner: Codex (operator)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `53337a5`

## Task Summary

A008-0110 established V2 principals, device credentials and one-use tickets but deliberately stopped before a usable V2 session transport. Complete Stage 3 by wiring authenticated V2 WebSocket admission and project/session business dispatch through the shared runtime owner, with live authorization and revocation enforcement.

## Task Charter

### Goal

Make V2 a usable authenticated session API without adopting Stage-4 recovery, sequencing or idempotency guarantees.

### Primary Deliverable

A host-owned `/v2/session` WebSocket using subprotocol `a008.v2`: first-frame ticket admission, principal/project-bound session operations, capability checks, live credential revocation handling and real-host regression proof.

### In Scope

- Shared V2 WS schemas/DTOs for authentication, commands, results and structured errors.
- `/v2/session` upgrade with the `a008.v2` subprotocol, current Origin policy and no credential in URL.
- First frame must authenticate with a one-use ticket within five seconds and be no larger than 4 KiB.
- Reject business frames before authentication; authenticated frames retain the advertised 1 MiB input bound.
- Bind each V2 connection to exactly one authenticated principal and registered project.
- Wire `session/new`, `session/inspect`, `session/prompt`, `session/cancel`, `session/control` and `tool/permission` through the existing shared `ProjectRuntimeRegistry` / `EngineHost` ownership.
- A session records its principal/project owner; wrong-project, wrong-principal and foreign-session access fail before runtime invocation.
- Recheck device existence, expiry, project scope and `session` capability on every V2 operation.
- Device revocation/expiry closes its live V2 sockets, cancels owned active work and denies pending tool permissions.
- Session-bound ticket issuance becomes available for sessions owned by that principal/project.
- V2 info advertises session transport only after the behavior exists.
- Preserve V1 HTTP/WS, ACP panels and current runtime/storage ownership unchanged.

### Out of Scope

- Stage 4: event sequence numbers, snapshot subscription boundary, stable message/turn IDs beyond what is minimally needed for request correlation, reconnect leases/resume, terminal turn outcome protocol and command receipts/idempotency.
- SDK/client package, web migration, Tauri/Expo implementation or platform secure storage.
- V2 migration of memory/upload/images/shell/provider/project-admin HTTP business routes.
- Durable chat/history across host restart, offline sync, multiple writers to one session or background-run survival.
- Provider calls, deployment, publication or changes to provider/runtime semantics.

### Definition of Done

- A real host accepts an authorized one-use ticket on `/v2/session` and refuses missing/late/oversized/reused/wrong-scope authentication.
- Authenticated session operations execute only in the ticket-bound project through the shared runtime owner.
- Foreign project/session/principal operations and missing capabilities fail with stable V2 errors before runtime work.
- Revoked/expired devices cannot continue operations; their live sockets close, active turns cancel and pending approvals resolve denied.
- V1 session behavior and ACP panel behavior remain regression-clean.
- Shared protocol/package schemas cover the V2 WS surface and independently install.
- Focused real-host security/session tests, full root tests, protocol verification, portable engine proof, GUI build and `git diff --check` pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `53337a5`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| V2 first-frame session admission | PC-01/05; ADR 0041 D4/D6/D7; CLIENT_API_V2 transport/auth | External clients still have credentials/tickets but no authenticated chat transport; Stage 3 remains unusable. | One `/v2/session` upgrade path using existing V2 tickets and shared runtime facade. | Real host accepts one valid ticket and refuses missing, late, reused, oversized or wrong-scope admission. |
| Principal/project/session authority | PC-01/05; ADR 0041 D1/D5/D7 | A client could affect another project/session or bypass the shared engine owner. | Bind socket/session ownership explicitly and authorize every operation before invoking EngineHost. | Two principals/projects plus wrong-pair tests prove isolation and no runtime call on refusal. |
| Live revocation and permission denial | PC-05; ADR 0041 D6/D7 | Revocation would only affect future HTTP while an already-connected device could keep executing or approve tools. | Recheck current principal per operation and track live device sockets so revoke/expiry cancels work, denies permissions and closes transport. | Revoke during active/pending work and prove no later prompt/control/approval executes. |
| Shared V2 wire contract | PC-01/06; ADR 0041 D4; ADR 0040 package boundary | Tauri/Expo would need host-private message shapes and textual error matching. | Add shared schemas/types and generated artifacts without importing runtime internals. | Installed protocol consumer parses auth/command/result/error fixtures. |

### Minimum Verification Gates

- [x] Pre-auth deadline/4-KiB and authenticated 1-MiB frame bounds are enforced on a real host.
- [x] One-use ticket binds principal/project and optional owned session; reuse and wrong pairing fail.
- [x] New/inspect/prompt/cancel/control/permission dispatch uses the shared project runtime owner.
- [x] Device expiry/revocation closes live transport, cancels owned active turn and denies pending permissions.
- [x] Cross-principal/project/session operations fail with structured V2 errors before runtime invocation.
- [x] Existing V1/ACP behavior remains unchanged under regression tests.
- [x] Full `npm test`, `npm run verify:protocol`, portable engine proof, GUI production build and `git diff --check` pass.

## References

- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/handoffs/A008-0110.md`
- `docs/CLIENT_API_V2.md`
- `docs/CLIENT_AUTH.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`

## Checklist

- [x] Claim A008-0112 on main and freeze bounded charter.
- [x] Extend the shared V2 WS contract and package artifacts.
- [x] Implement project-bound V2 session owner/dispatch over the existing registry/EngineHost.
- [x] Add first-frame admission, frame/deadline bounds and per-operation authorization.
- [x] Add live device revocation/expiry cancellation and permission denial.
- [x] Run focused real-host tests and full verification; update owning docs.
- [x] Archive, handoff and restore CURRENT_TASK before final commit.

## Decisions and Notes

- Stage 4 remains deliberately separate. A008-0112 may correlate requests and expose current session state, but it must not claim sequence/snapshot race guarantees, reconnect/resume, command receipts or durable turn outcome semantics.

## Verification

- Focused real-host V2 suite: 13/13 passed after final hardening. It covers actual one-use ticket admission, command dispatch, wrong subprotocol, 5-second timeout, 4-KiB pre-auth/1-MiB authenticated limits, project/principal/session isolation, second-writer and concurrent-new fencing, tool approval, cancel/control, credential revoke/expiry and outbound redaction.
- Final full root gate: 602 core + 4 membership + 162 GUI = 768 tests, zero failures/skips. Existing V1 resume/heartbeat, ACP/panels and tool-permission regressions remain green.
- `npm run protocol:schemas` and `npm run verify:protocol` passed; the packed/offline `@a008/protocol` consumer imports and validates V2 session frames.
- Production GUI build passed: 537.76 kB main JS / 162.26 kB gzip with existing Rollup annotation/chunk-size warnings.
- Final portable engine bundle was built outside the repository; its bundled Node served `/v2/info` advertising `auth.tickets` and `session.websocket` with the implemented limits, then the proof host was stopped.
- `git diff --check` and CURRENT_TASK/template identity passed in the final gate. No live provider call, real device grant, deployment or running-host restart was performed.
