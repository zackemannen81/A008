# A008-0204 â€” Electron desktop client for the A008 GUI

Task ID: A008-0204
Parent Task: None
Status: In Progress
Owner: Rickard (operator); implementation on `codex/A008-0204-electron-desktop-client`
Created: 2026-09-30
Last updated: 2026-09-30
Charter frozen at: Ready charter on branch `codex/A008-0204-electron-desktop-client`, base `abeacd8302d4aa0c8fc52766d5385017799c7678`

## Task Summary

Deliver the requested Windows desktop client as a locally runnable packaged
Electron application. Reuse `gui/` and the independently owned local GUI host;
the shell must not take over runtime or accepted-work ownership.

## Task Charter

### Goal

Provide a Windows x64 Electron client that presents the existing A008 GUI
through a verified compatible local host and preserves host-owned work across
client/window lifetimes.

### Primary Deliverable

A locally runnable Windows x64 Electron package under `clients/electron` that
presents `gui/`, reuses a healthy compatible local GUI host or starts the
existing host as a separate process, and loads the renderer only after
compatibility/readiness is verified.

### In Scope

- Add Electron at `clients/electron`; target Windows x64. Use Electron Forge
  unless an existing repository packaging standard is found. Produce locally
  runnable unpacked output; no installer.
- Package the existing GUI and portable existing A008 Node/runtime/GUI host.
  Reuse the repository's portable runtime-packaging mechanism. Start host as a
  separate OS process with its bundled Node executable and runtime resources.
- Resolve the existing `A008_GUI_HOST_BIND` and `A008_GUI_HOST_PORT` settings
  (default `127.0.0.1:8787`) and reject non-loopback HTTP endpoints. Probe
  `/health` identity and the GUI landing surface before attachment. Reuse a
  healthy compatible host. If none exists, start exactly one bundled host and
  wait for verified readiness. After bind/Platform ownership conflict, re-probe
  and attach only to a compatible A008 host; otherwise fail visibly and leave
  the incumbent untouched.
- Define compatibility using existing host evidence: `/health` must return
  `{ok:true,name:"A008-gui-host"}` and the endpoint must serve the existing GUI
  HTML surface. Add no second lease or protocol. Preserve existing host auth;
  never retain, bypass or invent credentials.
- Load the GUI from the configured host origin, preserving same-origin APIs,
  WebSocket, PIN cookies and the existing browser client/authentication path.
- Acquire Electron per-profile single-instance lock before probing/starting.
  A second launch focuses/restores the first and exits.
- Keep host process independent of BrowserWindow close/reload. Do not stop the
  host, workers or accepted work with a window; add no runtime lease, ownership
  mechanism or stop-host UI.
- Use `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`,
  `webSecurity:true`; restrict navigation to the configured host origin, deny
  arbitrary new windows/navigation, and do not add preload absent a demonstrated
  required desktop operation the host contract cannot perform.
- Add repeatable development/build/package commands and focused tests for the
  host and window decisions. Keep the standalone web GUI usable/buildable.
- Correct the portable packager's stale reference to absent
  `docs/CLIENT_AUTH.md` only as needed for this package.
- Update owning product docs and provide archive/handoff.

### Out of Scope

- Rewriting, redesigning or replacing `gui/`.
- Making Electron runtime/session/memory/lease/accepted-work owner; renderer
  communication with workers; parallel ownership or lifecycle manager; host
  shutdown controls; stopping/replacing a healthy host; auth bypass.
- Installer, signing, publishing, distribution, auto-update, or other OS targets.
- Sync, remote execution, new GUI features or unrelated refactors.

### Definition of Done

- A reproducible Forge win32/x64 package runs locally and contains the existing
  GUI and required standalone host/runtime/Node resources. No installer.
- Startup verifies loopback config, A008 GUI-host identity and GUI landing
  before creating/loading the renderer.
- No-host startup launches exactly one host and gates renderer load on readiness.
  Compatible host starts no replacement. Conflicts re-probe; incompatible
  owners remain untouched and fail visibly.
- Renderer uses the existing local host GUI/auth/client contract.
- Closing/reloading BrowserWindow during a run leaves host/worker/run alive;
  reopening reconnects to durable host state.
- Second profile instance focuses/restores the first and cannot probe/start host.
- BrowserWindow preferences/security meet the stated constraints; no unneeded
  preload API.
- Relevant root/GUI/Electron checks, Windows x64 package startup and lifecycle/
  reconnect verification pass, or any environmental skip is explicitly recorded.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/FILESTRUCTURE.md`, task
  archive and handoff accurately describe behavior and verification.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract.
Contract revision: `22c0542f518f0bf67dcc0d5a65d531cde029bf24`, unchanged on
`origin/main` `abeacd8302d4aa0c8fc52766d5385017799c7678`.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Windows x64 desktop package | PC-LF-01; operator specifies target, local output and deferred installer/signing/publishing | Requested desktop GUI absent | Thin Electron shell around existing GUI/host; Forge unless repository standard exists | Forge win32/x64 package and local launch |
| Host probe/compatibility | PC-LF-09; existing host `/health` identity and GUI surface | Wrong/stale endpoint or incompatible GUI could be loaded | Loopback endpoint; existing host identity plus GUI landing probe | Compatible, unknown and unavailable endpoint tests |
| Host bootstrap/resources | PC-LF-01/09 and ADR 0055 | No-host path unusable or duplicated runtime ownership | Existing portable host packaging and separate process; re-probe on conflict | One bootstrap, readiness and conflict/reprobe tests |
| Window/process ownership | PC-LF-05/09 and ADR 0055 | Client close could terminate accepted durable work | Never tie host shutdown to BrowserWindow | Accepted-run close/reopen durable-state test |
| Single shell/security boundary | PC-LF-09 and explicit operator constraints | Concurrent shell startup or privileged renderer | Per-user lock before probing; restricted BrowserWindow, no preload | Second instance and navigation/security tests |
| Documentation/regression proof | PC-LF-01/05/09 | Delivered ownership/startup boundary unclear or unverified | Update owning docs and focused regression checks | Build/tests, diff and documentation review |

### Minimum Verification Gates

- [x] Root typecheck/build; relevant GUI-host suite: `node --test dist/test/gui-host.test.js`.
- [x] GUI typecheck/build/tests; standalone web GUI build remains available.
- [x] Electron tests cover endpoint, identity/GUI compatibility, host reuse with
      no spawn, exactly-one bootstrap, readiness gating and conflict re-probe.
- [x] BrowserWindow close/reload does not stop host; accepted work continues and
      reopening observes durable state.
- [x] Second instance focuses/restores first; no additional probe or host start.
- [x] Security tests/review verify required preferences, allowed-origin
      navigation, blocked arbitrary navigation/new windows, no preload.
- [x] Forge win32/x64 package contains required GUI/host/runtime/Node resources
      and starts locally. No installer.
- [x] Review diff against Necessity Gate; `git diff --check`; owning docs/handoff.

## Verification Budget

No live model/provider behavior: 0 calls / 0 SEK. Local builds, package
installation and process/HTTP/window tests only. No external publication,
deployment or installer generation.

- Purpose/routes: Not needed; zero live calls.
- Owner/allocation: Rickard; serialized local work.
- Policy: `docs/TASK_WORKFLOW.md` at charter base; not-needed/zero.
- max_live_verification_cost: 0 SEK.
- max_live_verification_calls: 0.
- max_input_tokens_per_call / max_output_tokens_per_call: 0 / 0.
- live_call_timeout_seconds: 0.
- Credentials/providers/price basis: None/not applicable.
- Spend/reservations/unknown usage/attempts/remaining: 0 / 0 / 0 / 0 / 0 SEK.
- Workers/dispatch: none; local serialized verification.

## References

- `docs/PROJECT_BRIEF.md` â€” PC-LF-01/05/08/09.
- `docs/adr/0055-durable-sessions-and-process-ownership.md`.
- `docs/SYSTEMDOC.md` â€” GUI host/client and durable-work ownership.
- `src/gui-host/server.ts`, `src/gui-host/protocol.ts` â€” host identity/GUI.
- `src/gui-host/pin-auth.ts`, `src/gui-host/v2-auth.ts` â€” host auth.
- `scripts/package-engine.mjs` â€” portable runtime package.
- `gui/`, `docs/THIRD_PARTY.md`, lockfiles.
## Checklist

- [x] Verify task claim on `origin/main` at `abeacd8302d4aa0c8fc52766d5385017799c7678`.
- [x] Inspect host identity/auth/config, portable package and GUI origin behavior.
- [x] Freeze goal, scope, DoD, Necessity Gate, gates and provider budget.
- [x] Implement Electron bootstrap/reuse/readiness, security policy and Forge package.
- [x] Root/GUI/Electron typechecks, GUI build, focused tests, Forge Windows x64 package and standalone bundled-host readiness/GUI smoke check.
- [x] Update current status/system/structure docs, task index and handoff; package host runtime.

## Decisions and Notes

- **Mutable implementation note:** current `/health` returns
  `{ok:true,name:"A008-gui-host"}` without a version. Frozen compatibility uses
  this identity and the endpoint's existing GUI landing surface; no second lease
  or protocol. Fail closed for unknown hosts. Add a compatibility marker only if
  those existing checks prove insufficient, and keep it additive.
- **Mutable implementation note:** load host-served GUI (not `file:`/custom
  scheme) so existing same-origin API/WebSocket, cookies, browser credentials and
  origin checks remain authoritative.
- **Mutable implementation note:** use existing bind/port settings, reject
  non-loopback, and preserve host-owned auth/UI.
- `scripts/package-engine.mjs` references absent `docs/CLIENT_AUTH.md`; make only
  a necessary packager correction, without unrelated runtime refactoring.
- Installer, signing, publishing and auto-update remain deferred.

## Charter Amendment Log

- none

## Verification

- [x] Claim and Core Product Contract revision verified on fetched `origin/main`.
- [x] Inspected current name-only health, same-origin GUI, bind/port settings,
      PIN auth and portable packager.
- [x] Review implementation against frozen Necessity Gate; remaining DoD gates below are explicitly incomplete.
- [x] Record exact tests/build/package results in `docs/handoffs/A008-0204.md`; incomplete interactive GUI gates are listed there.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [ ] `docs/JOURNAL.md` (operator on merge)

## Handoff and Follow-ups

- Current state: Windows x64 Forge package and standalone packaged-host smoke check completed. GUI host reuse/bootstrap are implemented.
- Next: finish failure-path review, run the production host regression suite, verify per-profile second-launch/window behavior and accepted-run reconnect; then complete archive/handoff.
- Blockers: packaged Electron runs without an existing host but did not successfully bootstrap via its supervisor during this run; a standalone bundled-host probe passed. The desktop window/lifecycle tests need an interactive GUI session; accepted-run reconnect is not yet verified.
- Child tasks: none.
- Resume: continue within frozen scope; route new requirements via workflow.
- Open questions: determine why Electron main bootstrap did not bind the configured test port and complete interactive GUI lifecycle/reconnect verification.

## Finalize When Complete

- Archive under `docs/finished/`, restore `docs/CURRENT_TASK.md` from
  `docs/template_CURRENT_TASK.md`, and let the operator append the signed
  journal entry on merge.
