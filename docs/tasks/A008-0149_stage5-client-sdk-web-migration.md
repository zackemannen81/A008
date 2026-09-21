# A008-0149 — Stage 5 independent client SDK and bundled web migration

Task ID: A008-0149
Parent Task: A008-0103
Status: Complete
Owner: Grok (operator)
Created: 2026-09-21
Last updated: 2026-09-21
Charter frozen at: 2026-09-21; contract revision `24ff390d260520df572377663d59df74c4492667`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/backlog/host-client-api-boundary.md`
- `docs/CLIENT_API_V2.md`
- `docs/CLIENT_AUTH.md`
- `docs/adr/0040-stable-client-api-program.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`
- `docs/finished/A008-0140_stage4-restart-uncertainty-closure.md`

## Task Summary

A008-0103 Stages 1–4 are complete. Independent clients still cannot consume a packaged SDK, and the bundled GUI still owns V1 wire parsers plus per-module HTTP/WebSocket calls. Stage 5 starts by shipping a platform-independent client package and moving the existing web GUI onto that package so UI code no longer implements either wire.

## Task Charter

### Goal

Give supported web and future independent clients one injectable client SDK over the existing host contract so the GUI stops owning wire parsers, credential/header construction and transport recovery.

### Primary Deliverable

An independently installable `@a008/client` package plus a bundled-GUI migration in which session and HTTP surfaces go through that package, with cookie/device/engine adapters tested separately from React.

### In Scope

- `packages/client`: platform-independent HTTP/WebSocket client over `@a008/protocol`.
- Injected `fetch`, WebSocket constructor and credential adapter; no Node, React, runtime, memory or GUI imports.
- Explicit V1 and V2 adapters (ADR 0041 D4). Bundled GUI keeps current session behavior through the V1 session adapter, including PIN-disabled standalone, engine-panel capability, prompt attachments and in-session image generation.
- V2 adapter: public info, ticket, first-frame authenticate, session commands, command IDs, snapshot/event application, resume capability handling and explicit uncertainty without auto-resubmitting unknown mutations.
- Cookie (`credentials: include`), bearer-device and engine-capability adapters tested separately.
- V1 HTTP helpers for every current GUI host call: models, memory, upload/path import, shell, projects, catalogs, provider settings, MCP servers, images, frame-check, zero-cost and `/v2/info`.
- Bundled GUI modules stop implementing wire parsers and stop importing protocol parsers for network I/O; they consume the SDK. Presentation, navigation, theme and local drafts remain GUI-owned.
- Thin GUI React hook remains the React adapter; React is not a client-package dependency.
- Independent packed-package consumer proof and import-boundary checks.
- Update program/status/docs only after verification.

### Out of Scope

- Stage 6 Expo/native platform proof or secure-storage implementation.
- Stage 7 compatibility freeze or V1 removal.
- New V2 HTTP business routes from the CLIENT_API_V2 mapping table.
- Anonymous V2 access on PIN-disabled hosts.
- Extending V2 `session/prompt` with attachments or adding a V2 image-generation command in this child; those remain V1 session adapter obligations until a later bounded child.
- Durable sessions, offline sync, simultaneous writers, provider/memory/ACME changes, database migration.
- Changing PIN, device-grant or Origin policy.

### Definition of Done

- A clean consumer can install packed `@a008/client` plus `@a008/protocol` without A008 GUI/runtime source.
- SDK session and HTTP behavior is driven by injected transport/credentials.
- Cookie, bearer and engine adapters are unit-tested without React.
- V2 adapter never auto-resubmits a mutation after `COMMAND_UNKNOWN` or `SESSION_EXPIRED`.
- Bundled GUI session/HTTP modules have no remaining encode/parse/fetch wire owners; existing GUI tests keep passing.
- V1/ACP compatibility remains green.
- A008-0103 Stage 5 can truthfully move to Complete.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01/05/06.
Contract revision: `24ff390d260520df572377663d59df74c4492667`.
Accepted constraints: ADR 0040 Stage 5; ADR 0041 D4/D6/D7; CLIENT_API_V2 implementation gates; A008-0103 "no existing client silently breaks".

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Independent client package | PC-01; ADR 0040 Stage 5; CLIENT_API_V2 SDK gate | Independent clients keep copying GUI internals and drift from the host contract | `packages/client` over existing protocol/host owners | packed install + TypeScript consumer |
| Injected transport and credential adapters | PC-05; ADR 0041 D6/D7 | Secrets, cookies and panel tokens leak into React or URLs | cookie/bearer/engine adapters plus injected fetch/WebSocket | adapter unit tests; no secret in URL for V2 |
| GUI consumes SDK, not parsers | PC-01/06; ADR 0041 D4 | GUI remains a second wire owner; Stage 5 web coverage fails | move session/HTTP I/O into SDK; GUI re-exports view helpers | GUI tests plus grep that GUI has no encode/parse owners |
| V1 session adapter retained | PC-06; A008-0103 no silent break; ADR 0041 D4 | PIN-disabled/engine/attachment/image session would regress if forced onto incomplete V2 | bundled GUI uses V1 adapter; V2 is the independent path | existing GUI session tests; V2 SDK host test |
| Uncertainty without replay | PC-05; CLIENT_API_V2 receipts | SDK could retry a lost mutation after restart | surface `COMMAND_UNKNOWN`/`SESSION_EXPIRED`; never auto-resubmit | V2 client fixture |

### Minimum Verification Gates

- [ ] Packed `@a008/client` + `@a008/protocol` install outside A008; independent TypeScript consumer compiles and runs.
- [ ] Client package source imports only `./` and `@a008/protocol`; no Node/React/runtime/GUI/DOM-global coupling.
- [ ] Cookie, bearer and engine credential adapters tested separately.
- [ ] V2 SDK client authenticates, opens a session, prompts, inspects snapshot/events and refuses unknown-command replay against a real host.
- [ ] Bundled GUI session, upload, memory, shell, projects and settings tests pass through the SDK.
- [ ] Root typecheck/build, GUI typecheck, `test:core`, membership, GUI suite, `verify:protocol`, `verify:client` and `git diff --check` pass.
- [ ] No live/paid provider call is required.

## References

- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/backlog/host-client-api-boundary.md`
- `docs/CLIENT_API_V2.md`
- `docs/CLIENT_AUTH.md`
- `docs/adr/0041-client-api-v2-and-ownership.md`
- `packages/protocol/`

## Checklist

- [ ] Identity claimed on main.
- [ ] Charter frozen Ready after claim landed.
- [ ] Implement `@a008/client` with V1/V2 adapters and credential adapters.
- [ ] Migrate bundled GUI session/HTTP onto the SDK.
- [ ] Independent consumer and import-boundary proofs.
- [ ] Full verification and owning docs.
- [ ] Archive/handoff/restore CURRENT_TASK before push.

## Decisions and Notes

- React stays in `gui/src/session/use-gui-session.ts` as a thin store adapter over the SDK session client.
- Bundled chat does not switch to the V2 WebSocket in this child because V2 prompt/image/attachment parity is not implemented and PIN-disabled hosts cannot obtain V2 tickets. That is an accepted Stage-5 constraint, not a silent V1 forever promise.
- PIN 401 recovery redirect remains GUI-platform (`location.replace`); the SDK only exposes the V1 error shape.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/FILESTRUCTURE.md`
- [ ] `docs/CLIENT_API_V2.md` / `docs/CLIENT_AUTH.md`
- [ ] `docs/tasks/A008-0103_stable-client-api-program.md`
- [ ] `README.md` as needed
- [ ] archive + handoff; journal remains the operator merge entry

## Handoff and Follow-ups

- Current state:
- Next recommended step:
- Blockers:
- Child tasks:
- Resume condition:
- Open questions:

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
