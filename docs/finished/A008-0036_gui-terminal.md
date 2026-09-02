# Task A008-0036 — GUI terminal pane

Status: Complete
Owner: A008-worker05
Parent: A008-0030
Created: 2026-09-02
Completed: 2026-09-02
Branch: `grok/A008-0036-gui-terminal`
Clone: `C:\code\A008-workers\A008-worker05`

## Write scope

- `gui/src/terminal/**` only
- `docs/handoffs/A008-0036.md`
- `docs/finished/A008-0036_gui-terminal.md`

## Goal

Terminal pane + exported `runShellCommand(command)` that `fetch`es
`POST /v1/shell`. Fake the host in tests. Do not edit `src/gui-host/`.
Do not run shell in the browser (no eval, no WebContainer).

## Primary Deliverable

`gui/src/terminal/**` with kept `TerminalPane` and `runShellCommand` exports.

## Outcome

- `runShellCommand(command)` POSTs `{ command }` to `/v1/shell` via `fetch`.
  Optional injected `fetch` and `endpoint` exist only so tests can fake the
  host. Default endpoint is `/v1/shell` (Vite proxies `/v1` to the GUI host).
- The client never evaluates, spawns, or otherwise executes the command in the
  browser. There is no WebContainer, `eval`, `Function`, or `child_process`.
- Host protocol v1 result `{ stdout, stderr, exitCode, timedOut, truncated }`
  is formatted to a string for the composer (A008-0035).
- `TerminalPane` keeps the stub export and class `a008-terminal`. It submits
  through `runShellCommand` and records history. `App` still mounts
  `<TerminalPane />` with no props.
- `src/gui-host/` was not edited. Credentials are not sent (`credentials:
  "omit"`, no `Authorization`, no `NVIDIA_API_KEY`).

## Gates

- [x] Tests with a fake fetch/host (9 passed)
- [x] Restore CURRENT_TASK template
- [x] Handoff, PR, do not merge (handoff records the PR URL)

## Out of scope (honored)

- `src/gui-host/` and other `gui/src/*` directories
- Browser eval / WebContainer / local process spawn
- Live NVIDIA / paid calls
- Merge to `main`
- `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`, `docs/JOURNAL.md` (write
  scope and operator journal rule)

## Verification

Working directory: `C:\code\A008-workers\A008-worker05`
Date: 2026-09-02

- [x] `npx tsc -p tsconfig.json --noEmit` in `gui/` — exit 0
- [x] `npm run build` in `gui/` — tsc + Vite production build exit 0
- [x] Fake-host tests: emit `run-shell-command.ts` +
      `run-shell-command.test.ts` with tsc to `%TEMP%\A008-0036-terminal-test`
      and `node run-shell-command.test.js` — 9 passed, 0 failed. Cases:
      POST `/v1/shell` JSON body, no client execution, empty command does not
      fetch, stderr/timeout/truncation/null exit, HTTP error mapping, network
      failure, malformed JSON, no `NVIDIA_API_KEY` / `Authorization`.
- [x] `git diff --check` — no whitespace errors
- [x] Source under `gui/src/terminal/` has no `eval(`, `new Function`,
      `WebContainer`, `child_process`, or `spawn(`
- Skipped: live GUI host / real `/v1/shell` (A008-0032 owns the host; charter
  says fake the host)
- Skipped: in-browser click-through of `TerminalPane` (no browser tools in
  this worker). Closest substitute: GUI typecheck/build plus fake-fetch unit
  tests of `runShellCommand`.
- Skipped: root `npm test` (no root product source changed)
- Skipped: `docs/JOURNAL.md` append (operator on merge)
- Skipped: merge to `main` (operator only)

## Documentation Updates

- [x] `docs/finished/A008-0036_gui-terminal.md` (this archive)
- [x] `docs/CURRENT_TASK.md` restored from `docs/template_CURRENT_TASK.md`
- [x] `docs/handoffs/A008-0036.md` (follow-up commit after the PR URL exists)
- [ ] `docs/CURRENT_STATUS.md` — outside write scope
- [ ] `docs/SYSTEMDOC.md` — outside write scope
- [ ] `docs/JOURNAL.md` — operator on merge

## Handoff and Follow-ups

- Current state: Complete on A008-worker05; awaiting operator merge.
- Next recommended step: operator reviews the PR; A008-0032 must serve
  `POST /v1/shell`; A008-0035 composer should call `runShellCommand`.
- Blockers: none for this slice.
- Child tasks: none.
- Open questions: none.
