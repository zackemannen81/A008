# A008-0065 — GUI session commands and model parameters

Task ID: A008-0065
Parent Task: None
Status: In Progress
Owner: Codex (operator)
Created: 2026-09-06
Last updated: 2026-09-06
Charter frozen at: 2026-09-06, after main claim `f255996`

## Task Summary

The owner requests all interactive CLI commands in the existing A008 diagnostic
GUI and selected-model generation parameters, using the supplied parameter-panel
image as a layout reference. Existing composer placeholders do not control runtime
history or model selection. This task connects them to the shared core.

## Task Charter

### Goal

Operate and inspect a real A008 chat session from GUI with CLI command parity and
validated model generation settings.

### Primary Deliverable

Working GUI session commands, discoverable controls and an accessible parameter
panel backed by an additive host/ACP contract and actual provider request options.

### In Scope

- Help, end session, reset, undo, committed history, model registry/selection,
  runtime status/cwd/tools and native user-initiated shell, including all aliases.
- Stream, temperature omission or 0–1, top P, total generated-token limit,
  model-supported reasoning toggle/budget/effort and supported seed/stop controls.
- Model-specific validation and wire mapping, per-session settings, transactional
  history synchronization, busy/cancel/error/disconnect behavior and mobile access.
- Fake-provider tests, browser verification, owning docs, ADR and task closure.

### Out of Scope

- External product client, memory editing, autonomous shell/tool execution,
  multimodal chat, credentials in renderer, durable settings/history storage.
- Provider-spend or input-token accounting caps, paid/live provider tests, push,
  deployment or publication. Total token control means generated output including
  reasoning, not input plus output or a monetary budget.

### Definition of Done

- All requested commands affect or report the actual runtime state, with aliases.
- GUI configuration reaches chat payloads; disabled options are omitted and do
  not accidentally inherit profile defaults. Semantic-memory calls stay isolated.
- Unsupported options and invalid values fail before a provider call.
- Existing memory views, shell/upload, protocol clients and CLI continue working.
- Verification evidence, owning docs, immutable archive and handoff exist;
  CURRENT_TASK is restored before final commit.

### Minimum Verification Gates

- [x] Root and GUI typecheck/build; complete root npm test.
- [x] Contract/ownership/busy/error tests and actual spawned ACP loopback proof.
- [x] Actual provider payload assertions, history/reset/undo/model lifecycle proof.
- [x] Desktop/mobile browser controls, parameter application, command and memory navigation proof.
- [ ] Changed docs links/fences, diff hygiene and staged credential-boundary review.

## Checklist

- [x] Read repository authority and inspect existing command/session paths.
- [x] Claim identity on main; freeze this charter before source changes.
- [x] Add protocol and runtime controls with validated parameter metadata.
- [x] Implement GUI controls, parameter panel and authoritative history.
- [ ] Verify, update owning documentation, archive and hand off.

## Decisions and Notes

- ADR 0026 owns the additive integration contract. Existing v1 frames stay valid.
- Reset/undo do not delete durable memory, matching CLI behavior. End closes the
  browser-owned session; the GUI page and host remain available.
- No delegation. Owner concept files in docs/concepts_sandbox/gui remain untouched.

## Charter Amendment Log

- None.

## Verification

530 test executions passed; both typechecks and GUI build passed. Full chain and browser evidence: [session-controls-proof](evidence/A008-0065_session-controls-proof.md). Staged audit and archival pending.

## Handoff and Follow-ups

Implementation in progress on `codex/A008-0065-gui-session-controls`.
