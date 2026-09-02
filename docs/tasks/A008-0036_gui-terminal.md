# Task A008-0036 — GUI terminal pane

Status: Ready
Owner: A008-worker05
Parent: A008-0030
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

## Gates

- Tests with a fake fetch/host
- Restore CURRENT_TASK template, handoff, PR, do not merge
