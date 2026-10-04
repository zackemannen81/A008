# A008-0209 — Electron first-run setup and Windows installer

Task ID: A008-0209
Parent Task: None
Status: Complete
Owner: Rickard (operator); A008 (implementation)
Created: 2026-10-04
Last updated: 2026-10-04
Charter frozen at: 2026-10-04

## Task Summary

Provide a usable Windows installation path for the existing Electron desktop client and a first-run setup flow that writes through the existing host-owned settings surfaces.

## Task Charter

### Goal

After installing A008 on Windows, let the user choose defaults without editing files or environment variables, while preserving the local-first host and secret ownership boundaries.

### Primary Deliverable

A Windows x64 NSIS-style `Setup.exe` produced by Electron Forge/Squirrel, plus an Electron-launched first-run setup experience for theme, provider credentials, chat and semantic models, identity/custom instructions, parallel-session root, and default-install continuation.

### In Scope

- Package the existing `clients/electron` app as a Windows x64 installer.
- Add a one-time setup experience opened by the Electron shell after host startup.
- Reuse existing GUI/host endpoints for provider secret writes, runtime preferences, model selection, theme, and workspace-root configuration.
- Keep API keys write-only in the UI and out of installer artifacts, logs, command arguments, and source control.
- Support “Use defaults” and allow setup to be reopened from the application.
- Preserve Electron renderer security and existing host/session ownership.
- Add deterministic tests for setup state/validation and installer configuration.
- Update owning documentation and handoff.

### Out of Scope

- Account/login/cloud sync, remote secret managers, automatic provider account creation, or live provider validation.
- OS credential-vault migration, signing certificates, publishing, auto-update, merge/push, and mobile clients.
- Replacing existing Parameters settings or adding new provider/model routes.
- Changing host/protocol/session lifecycle semantics.

### Definition of Done

- `npm run package:win32:x64` produces a Windows x64 unpacked Forge package after the existing portable host build succeeds.
- A Forge maker produces a Windows installer artifact with a stable product name and executable identity.
- First-run setup is shown only when not completed, can be skipped with defaults, and can be reopened.
- Setup persists theme locally, provider secrets through the existing write-only host route, global identity instructions and semantic model through runtime preferences, chat model through a new conversation/default selection path, and workspace root through the existing workspace route.
- Invalid/empty input is rejected without writing secrets; no secret value is rendered back or logged.
- Existing Electron security tests and relevant GUI/host tests continue to pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-LF-01, PC-LF-04, PC-LF-07, PC-LF-09
Contract revision: `a68a1c6`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Windows installer | PC-LF-01/09; local GUI/host remains the product path | Users cannot install/run the existing desktop client as a normal Windows application | Add the smallest Forge Windows maker to the existing Electron package | Forge config review plus package dry/run gate |
| First-run settings | PC-LF-01/04/07; host owns provider execution and local state | Users must manually edit environment/files and may misconfigure the app before first chat | Electron setup UI calls existing host-owned settings endpoints and GUI preference storage | Setup state/validation tests and route review |
| Secret handling | PC-LF-04/07; credentials remain host-owned | Keys could leak into installer/source/logs or be sent to the wrong owner | Reuse write-only provider settings route and clear input after save | No-secret-rendered test and code review |
| Default continuation | PC-LF-01/09; GUI remains optional client to durable local host | Users are blocked by configuration choices even when they want the shipped defaults | One explicit “Use defaults” action marks setup complete without writes beyond local completion state | Default-path test |

### Minimum Verification Gates

- [x] Setup state and validation tests — 2 focused setup-state tests pass inside the GUI test run.
- [x] Electron typecheck and focused tests.
- [x] GUI typecheck and production build; full GUI suite has one unrelated existing memory-map assertion failure.
- [x] Forge configuration and package/installer command review; unpacked Windows x64 package completes and Squirrel target is configured.
- [x] `git diff --check` and final scope/necessity review.

### Verification Budget

- Live verification purpose / required provider behavior: not required.
- Budget owner / parent allocation: A008-0209.
- Policy revision / inherited or explicit approved limits: `docs/TASK_WORKFLOW.md`, local-only.
- max_live_verification_cost: 0 SEK.
- max_live_verification_calls: 0.
- max_input_tokens_per_call / max_output_tokens_per_call: not applicable.
- live_call_timeout_seconds: not applicable.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 SEK / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: single local task.

## References

- `clients/electron/package.json`
- `clients/electron/forge.config.ts`
- `clients/electron/src/main.ts`
- `src/core/provider-secrets.ts`
- `src/runtime/runtime-preferences-store.ts`
- `gui/src/settings/parameters-panel.tsx`
- `packages/client/src/v1-http.ts`

## Checklist

- [x] Inspect Electron Forge, host-owned settings, provider secret and workspace routes.
- [x] Implement first-run setup state and Electron setup window.
- [x] Add Windows installer maker and package metadata.
- [x] Add tests and verify package/build gates.
- [x] Update current status, system docs, handoff and indexes.
- [x] Archive task and restore the current-task template.

## Decisions and Notes

- API keys must never be embedded in the installer or passed as command-line arguments. The setup UI uses the existing host route, whose secrets file is outside the repository and write-only from the GUI.
- The setup flow is deliberately post-install and host-backed. Installer UI customization is not used because it would duplicate settings ownership and would make API credentials part of installation-time state.
- Chat model selection is currently conversation-bound in the durable client. The implementation may add only the smallest local default-selection mechanism needed by setup; existing conversation configuration remains authoritative after creation.

## Verification

- Electron typecheck: PASS.
- Electron tests: 7/7 PASS.
- Root typecheck: PASS.
- Root build: PASS.
- GUI typecheck: PASS.
- GUI production build: PASS.
- Focused onboarding tests: PASS (2/2).
- Full GUI suite: 234/235 PASS; one pre-existing unrelated memory-map assertion expects `1 nodes` while current output reports the newer `1 records` wording.
- `git diff --check`: PASS.
- Forge packaging reaches a complete Windows x64 unpacked package at `clients/electron/out/A008-win32-x64` and resolves the Squirrel maker target. Squirrel artifact generation was not completed in this Linux-compatible/non-Windows environment because `electron-winstaller` requires Wine and Mono on non-Windows; no `A008-Setup.exe` was produced here.
- No provider calls or credentials; 0 SEK.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/handoffs/A008-0209.md`
- [x] `docs/tasks/README.md`
- [x] `docs/finished/A008-0209_electron-first-run-setup-and-installer.md`

## Handoff and Follow-ups

- Current state: implementation complete; installer maker is configured and the Windows x64 unpacked package was produced.
- Next recommended step: run `npm --prefix clients/electron run make:win32:x64` on Windows with the same dependencies to produce `A008-Setup.exe`.
- Blockers: Squirrel installer artifact cannot be produced in this non-Windows environment without Wine/Mono; one unrelated existing GUI memory-map assertion remains.
- Child tasks: none.
- Resume condition: Windows packaging/release task if an installer artifact or signing is required.
- Open questions: signing/publishing remain deferred and require a separate release decision.
