# Task A008-0038 — Release ACP sessions on renderer disconnect

Status: Ready
Owner: operator-delegated
Parent: A008-0030 follow-up
Created: 2026-09-02
Charter frozen at: 2026-09-02
Branch: `claude/A008-0038-acp-session-release`
Clone: `C:\code\A008-workers\A008-0038_acp-session-release`

Activates item 1 of [`../backlog/gui-hardening.md`](../backlog/gui-hardening.md).

## Task summary

The GUI host creates one ACP session per `session/new` frame and tracks it in a
per-socket `ownedSessions` set. When the renderer disconnects, the socket is
dropped from the host's socket set but the ACP session is never released, so
`A008AcpAgent`'s process-local session map and the bridge's prompt-handler map
both grow for the life of the host. It is bounded for local single-user use and
must be owned before any longer-running or shared host.

## Goal

A renderer disconnect releases every ACP session that socket owned, in both the
GUI host and the `A008-acp` agent, with no leaked session state on either side.

## Primary deliverable

An implemented ACP `session/close` path end to end: agent capability and
handler, bridge method, and host release on socket close.

## In scope

- `src/acp/A008-acp-agent.ts`: implement the optional `closeSession` handler and
  declare the matching agent capability in `initialize`. Closing a session must
  abort any active turn for that session and remove its state. Closing an
  unknown session must fail closed with the existing typed error style rather
  than silently succeeding.
- `src/acp/server.ts`: wire the handler into the connection if the SDK requires
  explicit registration.
- `src/gui-host/acp-bridge.ts`: add a session-release method to `AcpBridge` that
  calls the SDK `closeSession` request and drops the local prompt-handler entry.
- `src/gui-host/server.ts`: on socket close, release every session in that
  socket's `ownedSessions`, then clear the set. A release failure must not throw
  out of the close path or take the host down.
- New cases in the existing `test/acp-agent.test.ts` and `test/gui-host.test.ts`.

## Out of scope

- `gui/` and any renderer change. The browser sends no close frame; release is
  driven by the socket closing.
- Host protocol v1 frame changes. No new client or server frame type.
- `src/memory/`, `src/tools/terminal.ts`, `src/orchestration/`.
- Idle-session timeouts, session limits, or a reaper. Disconnect-driven release
  only.
- `package.json`. New tests go in the two existing files, which the root `test`
  script already runs. A008-0039 owns script wiring.

## Definition of done

- A disconnecting renderer leaves zero sessions behind in the agent's session
  map and zero entries in the bridge's handler map.
- A second socket's sessions are unaffected when the first socket disconnects.
- An in-flight prompt on a released session is aborted, not orphaned.
- Releasing an unknown or already-released session is safe and observable.

## Minimum verification gates

- [ ] A test proves the agent's session map is empty after `closeSession`, and
      that a session belonging to another socket survives.
- [ ] A test drives a real WebSocket connect, `session/new`, disconnect, and
      asserts the host released the session rather than asserting only that the
      socket closed.
- [ ] A test covers close of an unknown session and double close.
- [ ] A test covers disconnect while a prompt is streaming.
- [ ] `npm run typecheck` clean.
- [ ] `npm test` green. Baseline is 234 passing; the delta must be new cases
      only, with no existing case weakened or removed.

## References

- [`../adr/0019-a008-owned-gui.md`](../adr/0019-a008-owned-gui.md) D3, D4
- [`../adr/0004-agent-canvas-acp-boundary.md`](../adr/0004-agent-canvas-acp-boundary.md)
- [`../backlog/gui-hardening.md`](../backlog/gui-hardening.md) item 1
- `@agentclientprotocol/sdk` 1.4.0: `AGENT_METHODS.session_close`,
  `CloseSessionRequest`, `SessionCloseCapabilities`

## Decisions and notes

- ADR 0004 is not amended. `session/close` is an existing stable-v1 ACP method
  that A008 has simply not implemented; adding it does not move the boundary.
- Agent Server is also an ACP client of this agent. Adding an optional method
  and its capability must not change behavior for a client that never calls it.
  A test should confirm the existing initialize contract still holds.
