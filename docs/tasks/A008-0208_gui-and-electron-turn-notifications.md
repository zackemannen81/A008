# A008-0208 — GUI and Electron turn outcome notifications

Task ID: A008-0208
Parent Task: None
Status: Complete
Owner: Rickard (operator); A008 (implementation)
Created: 2026-10-03
Last updated: 2026-10-03
Charter frozen at: 2026-10-03

## Task Summary

A008-0208 implements GUI/Electron notifications for observed durable turn outcomes. A008-0207 is paused by explicit operator instruction, with its original charter preserved separately in `docs/paused/`.

## Task Charter

### Goal

Make durable run completion and failure noticeable in `/gui`, including the Electron client, with an opt-in visual and sound signal.

### Primary Deliverable

Notifications for terminal durable-run transitions using a dismissible in-GUI notice, blinking page title, optional sound, and Electron window attention when unfocused.

### In Scope

- Detect only observed active-to-terminal transitions; distinguish success, failure and uncertain outcome.
- Notify once per run in the current renderer lifetime; do not notify from initial terminal history.
- Restore title on focus/visible state or bounded timeout.
- Add a GUI setting for optional sound, default off; ignore playback/autoplay errors.
- Integrate Electron's existing window with renderer page-title notifications; do not add preload/IPC or host/protocol behavior.
- Add deterministic GUI and Electron tests.
- Update owning docs and handoff.

### Out of Scope

- Server, host, protocol/schema changes, notification service or durable receipts.
- Cross-client/global notifications, OS permission prompts, mobile changes or custom sound assets.
- Any run execution/retry/scheduling changes.

### Definition of Done

- Terminal transition succeeds only for the same run identity after an observed active state; duplicate polling is silent.
- Title attention and the in-GUI notice distinguish succeeded, failed and uncertain results and restore/expire as specified.
- Electron flashes only while unfocused and stops on focus or after eight seconds; renderer security stays unchanged.
- Sound is off by default and playback errors do not alter chat state.
- GUI/Electron tests, typechecks/builds and diff check pass or remaining environment blockers are explicitly documented.
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, handoff, indexes and task record reflect observed behavior.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-LF-05, PC-LF-08, PC-LF-09
Contract revision: `218dda50ae01bd0faa278ab59b5eb1eaf67b6301`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Run terminal notice | PC-LF-05/08/09; ADR 0059 preserves host-owned execution and GUI observation | User may miss completion/failure while away; no durable receipt required | Renderer detects active-to-terminal transition in existing run snapshot | run transition tests for success/failure/uncertain, identity and duplicates |
| Bounded attention | PC-LF-09; Electron remains client and does not own run lifecycle | Outcome can be visually unnoticed in background | Title blink, restore on focus/visibility/timeout; Electron derives bounded flash from title update | focus/visibility/timer tests and Electron attention test |
| Opt-in sound | PC-LF-09; non-blocking observation, avoid intrusive defaults | Visual signal alone may be missed; unsolicited sound is intrusive | Store one boolean in existing GUI preferences and generate brief Web Audio tone only when enabled | default, persistence, playback rejection tests |

### Minimum Verification Gates

- [x] GUI notification transition/preferences tests — test source TypeScript safety errors repaired; execution remains blocked by missing `esbuild`.
- [x] Electron attention tests.
- [ ] GUI typecheck, tests, build — blocked by missing React/type declarations and `esbuild` in this worktree.
- [x] Electron typecheck, tests.
- [x] `git diff --check` and final scope/necessity review.

### Verification Budget

- Live verification purpose / required provider behavior: not required.
- Budget owner: A008-0208.
- Policy: `docs/TASK_WORKFLOW.md`; local tests only.
- Maximum live cost: 0 SEK; maximum calls: 0.
- Approved provider routes: none.
- Observed usage: 0 SEK / 0 calls.

## References

- `gui/src/session/durable-chat-client.ts`
- `gui/src/session/run-notifications.ts`
- `gui/src/session/notification-preferences.ts`
- `gui/src/settings/parameters-panel.tsx`
- `clients/electron/src/main.ts`
- ADR 0055 and ADR 0059

## Checklist

- [x] Inspect paused task and existing durable run observation/Electron ownership.
- [x] Implement renderer outcome tracker, title attention, GUI notice and opt-in audio preference.
- [x] Connect Electron window title/attention handler without preload/IPC.
- [x] Verify/repair compilation and run focused plus full relevant test gates; test-only unchecked indexed callback errors repaired. GUI execution remains blocked by missing dependencies.
- [x] Update current status and review system docs for accurate descriptions.
- [x] Write handoff and finish task documentation.

## Decisions and Notes

- Task code has been authored but verification is pending. Current workspace lacks installed root, GUI and Electron dependencies, so validation must address environment reproducibly; no install was performed yet.
- `docs/tasks/A008-0207_finalize-edit-recovery-benchmark.md` is moved to `docs/paused/A008-0207_finalize-edit-recovery-benchmark.md`. The snapshot is `docs/paused/A008-0207-current-task.md`; pause summary is `docs/paused/A008-0207-pause.md`.
- A008-0207 itself remains in progress conceptually and is not reported complete.

- [x] Electron unit tests: `npm --prefix clients/electron test --silent` — 7/7 PASS (host-controller, renderer-security and window attention).
- [x] Electron main-process TypeScript check using Electron-local TypeScript 5.9.3 and installed Electron/Node types; initial syntax defect repaired.
- GUI `npm run typecheck`, `npm test` and build — blocked: React/type declarations and `esbuild` are missing in the current worktree. `npm --prefix gui run build` fails on unresolved React types; focused test launch fails with `ERR_MODULE_NOT_FOUND: esbuild`. No install performed in this resumed verification.
- [x] `git diff --check` — PASS.
- No provider calls or installs; 0 SEK.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/handoffs/A008-0208.md`
- [x] `docs/TASK_IDS.md`, task index and paused-task index

## Handoff

- Current state: Implementation complete within scope; Electron validation passes. GUI test code's TypeScript indexed-access errors are repaired. GUI typecheck/build/tests remain blocked by missing React/type declarations and esbuild in this worktree.
- Next step: Restore dependencies and run GUI typecheck, tests and production build.
- Blockers: incomplete/missing local GUI/root dependencies.
- A008-0207 remains paused and resumes after this handoff.
