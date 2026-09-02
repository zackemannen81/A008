# Task A008-0033 — GUI session client

Status: Ready
Owner: A008-worker02
Parent: A008-0030
Branch: `grok/A008-0033-gui-session`
Clone: `C:\code\A008-workers\A008-worker02`

## Write scope

- `gui/src/session/**` only (replace the stub)
- `docs/handoffs/A008-0033.md`
- `docs/finished/A008-0033_gui-session.md`

Do not edit other `gui/src/*` directories, `src/gui-host/`, or leave a filled
CURRENT_TASK.

## Goal

Browser client for host protocol v1. `useGuiSession()` connects, lists no
secrets, holds sessionId, thought/answer buffers, connection state, and
`prompt` / `cancel`. Keep the export names in the stub.

## Gates

- Unit tests in `gui/` or `test/` that fake a WebSocket
- No `NVIDIA_API_KEY` in client source
- Restore CURRENT_TASK template, handoff, PR, do not merge
