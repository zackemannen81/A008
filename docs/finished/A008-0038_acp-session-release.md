# Task A008-0038 — Release ACP sessions on renderer disconnect

Status: Complete
Owner: operator-delegated
Parent: A008-0030 follow-up
Created: 2026-09-02
Completed: 2026-09-02
Branch: `claude/A008-0038-acp-session-release`
Base revision: aad3f21

Closed item 1 of `docs/backlog/gui-hardening.md`.

## Goal

A renderer disconnect releases every ACP session that socket owned, in both the
GUI host and the `A008-acp` agent, with no leaked session state on either side.

## What was wrong

`src/gui-host/server.ts` created one ACP session per `session/new` frame and
tracked it in a per-socket `ownedSessions` set. On socket close it removed the
socket from its `sockets` set and aborted in-flight prompts, but never released
the sessions. `A008AcpAgent`'s `#sessions` map and the bridge's `handlers` map
both grew for the life of the host process.

The A008-0032 handoff recorded this as "no session-close request in this SDK
usage". That was true of A008's usage and not of the protocol:
`@agentclientprotocol/sdk` 1.4.0 already carries `AGENT_METHODS.session_close`,
`CloseSessionRequest`, and `SessionCloseCapabilities`, and exposes the agent
handler as an optional `closeSession?()`. A008 had simply never implemented it.

## Change

- `src/acp/A008-acp-agent.ts` implements `closeSession`: it aborts any active
  turn for the session, deletes the session state, and returns `{}`. Closing a
  session the agent does not hold raises the same typed error every other
  session-scoped method here uses, so a double close or a stale identity is
  observable rather than silently successful. `initialize` now advertises
  `agentCapabilities.sessionCapabilities.close`. A new `openSessionIds()`
  accessor makes leaked session state directly assertable.
- `src/acp/server.ts` registers a `session/close` request handler. The fluent
  agent builder registers nothing implicitly, so the optional method needs its
  own handler even though the capability is advertised.
- `src/gui-host/acp-bridge.ts` adds `closeSession(sessionId)` to `AcpBridge`.
  It drops the local prompt-handler entry first, then issues the SDK request,
  so the bridge never keeps a callback for a session the host gave up.
- `src/gui-host/server.ts` releases every session in the closing socket's
  `ownedSessions`, then clears the set. It reads the existing `bridge` binding
  rather than calling `getBridge()`, so a socket that never opened a session
  cannot spawn an ACP subprocess on its way out. Release failures are contained:
  they run on a close path with no client left to tell, and a rejection there
  would surface as an unhandled rejection.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Full suite | `npm test` | 243 pass, 0 fail |

Baseline on `main` was 234. The delta is 9 new cases and no existing case was
weakened, skipped, or deleted.

New agent cases in `test/acp-agent.test.ts`:

- `session/close` releases only the session it names, leaving a second session
  open
- `session/close` fails closed on an unknown session and on a double close
- `session/close` aborts the turn in flight on that session, and the released
  turn does not commit to `ChatSession.messages`
- the capability is advertised without changing any field an existing client
  already reads, so Agent Server is unaffected

New host cases in `test/gui-host.test.ts`:

- a disconnecting renderer releases every session it owned, and releases none
  while the socket is still open
- one renderer disconnecting leaves another renderer's session alone, and the
  survivor is still usable afterwards
- a socket that opened no session releases nothing and starts no bridge
- a failing release does not take the host down; `/health` still answers
- disconnecting while a prompt streams aborts the turn and still releases

### Mutation checks

Both halves were proved load-bearing rather than assumed:

- Removing `await releaseSessions(ownedSessions)` from the socket close path:
  **4 of the 5 host cases fail** (243 tests, 239 pass, 4 fail). The fifth
  correctly still passes, because it asserts that nothing is released.
- Removing `this.#sessions.delete(params.sessionId)` from `closeSession`:
  **3 cases fail** (243 tests, 240 pass, 3 fail).

Both mutations were reverted and the suite returned to 243 pass, 0 fail.

## Out of scope and not done

- No `gui/` change. The browser sends no close frame; release is driven by the
  socket closing.
- No host protocol v1 frame change.
- No `package.json` change. New cases went into the two existing test files,
  which the root `test` script already runs. A008-0039 owns script wiring.
- No idle-session timeout, session cap, or reaper. Disconnect-driven release
  only. A host whose renderer never disconnects cleanly still holds its
  sessions until the process exits.
