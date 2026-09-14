# A008-0100 - release stale GUI session after close failure

Task ID: A008-0100
Parent Task: A008-0099
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Last updated: 2026-09-14
Charter frozen at: 2026-09-14

## Task Charter

### Goal and Primary Deliverable

Selecting an existing project while connected starts a fresh GUI session even
when the host has already discarded the previous ACP session.

### In Scope

- Ensure endSession performs its existing local cleanup after a rejected close.
- Keep the close rejection observable to direct callers.
- Regression for stale close, socket disposal and a fresh session/new handshake.
- Authenticated browser project switching, GUI tests/build and documentation.

### Out of Scope

Host process ownership, project bootstrap mutation semantics, auth policy,
provider calls, pushes, deployments and merges.

### Definition of Done / Minimum Verification Gates

- Rejected close leaves no locally ready session or reusable socket.
- Late old-socket events cannot update the client; reconnect creates a new session.
- Existing successful exit and reconnect regressions pass.
- GUI tests and production build/typecheck pass.
- Owner's authenticated browser can select an existing project while connected.
- Diff/necessity review, immutable archive, handoff and template restoration.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md Core Product Contract
Contract revision: 5db2624

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Always discard an explicitly ended local session | PC-06 supported session controls; ADR 0026 D1/D3/D6 and ADR 0039 existing-project open | Project open replaces the ACP process before renderer close; rejected close skips cleanup, leaving ready/old ID, and connect returns without starting a session | Run existing endSession local teardown in finally, preserving the rejection; reuse existing project callback catch/finally | Stale-close regression and real authenticated project switch |

## Evidence and Notes

- Observed after A008-0099 fixed the cookie loop: selecting an existing project
  while ready displays Unknown A008 ACP session and keeps the stale ready state.
- server.applyWorkspace closes the old ACP bridge. App onOpened then calls
  endSession; its rejected close prevents local teardown. connect is idempotent
  while status remains ready. Existing caller already catches close and reconnects.
- No new fallback, timeout, host protocol or session owner is needed.

## Verification

- GUI suite: 161 passed, including stale-close rejection, local idle state, old
  socket disposal, late-event isolation, fresh session/new and a new ready ID.
- Existing successful close, pending-prompt cancellation and reconnect tests pass.
- Production GUI build/typecheck passed. Initial build caught an optional-interface
  invocation in the new test; its non-null assertion was corrected before passing.
- Owner's authenticated localhost browser: Connect remains ready; opening a project
  from idle works; switching from one already-connected registered project to
  another updates the runtime cwd without a reload or stale-session error.
- Returned the browser to its original project and left it connected.
- No prompt/provider call, private upload, host restart, push or merge.
- Final necessity/diff review: existing teardown moved into finally only. No new
  protocol, cleanup mechanism, retry, dependency or host behavior.
- git diff --check and current-task template identity passed.

## Documentation and Handoff

CURRENT_STATUS, SYSTEMDOC, immutable finished archive and handoff. No module/map
change. Operator journal on main integration; no integration performed here.
