# A008-0092 — Mobile WebSocket recovery

Task ID: A008-0092
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-09
Last updated: 2026-09-09
Charter frozen at: 2026-09-09; contract revision `f17d476a0ca77c1c3900e82481ac601a3c3b6ef0`

## Task Summary

Make the standalone A008 GUI tolerate short mobile-network and browser-suspension WebSocket drops without requiring a manual reconnect or immediately destroying the owned ACP session.

## Task Charter

### Goal

Keep an active standalone GUI conversation usable across brief WebSocket interruptions while preserving explicit session ownership, credentials, tool approvals and cancellation boundaries.

### Primary Deliverable

A bounded host/client recovery path with WebSocket heartbeat, automatic reconnect and a short authenticated resume grace period for the existing ACP session.

### In Scope

- Host-initiated WebSocket ping heartbeat with bounded liveness handling.
- Short detached-session grace period before ACP session release.
- Ephemeral unguessable resume capability bound to the existing session.
- `session/resume` protocol path that reattaches one detached session only.- Client reconnect with bounded backoff after unexpected socket error/close.
- Preserve the existing conversation/session snapshot when resume succeeds.
- Fail back to an explicit disconnected/error state when resume expires or is refused.
- Tests for heartbeat, resume ownership/expiry, reconnect and unchanged tool approval security.

### Out of Scope

- Durable session persistence across host restart or page reload.
- Cross-device resume, accounts, distributed session storage or Cloudflare configuration.
- Replaying an in-flight prompt after transport loss.
- Changing provider, memory, artifact or repository-tool semantics.

### Definition of Done

- [x] Idle standalone WebSockets receive periodic protocol pings and dead peers are closed.
- [x] Unexpected disconnect retains an idle ACP session only for the configured short grace period.
- [x] A reconnecting authorized browser can resume only with the session's ephemeral resume capability.
- [x] Client reconnects automatically with bounded backoff and returns to ready when resume succeeds.
- [x] Expired/invalid resume cannot hijack a session and eventually releases it.
- [x] In-flight work is cancelled on disconnect rather than silently replayed.
- [x] Full test/build gates pass and owning docs describe the behavior.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `f17d476a0ca77c1c3900e82481ac601a3c3b6ef0`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Heartbeat/reconnect | PC-01, PC-06; standalone GUI is a supported client of the shared engine | Mobile/4G sockets can die while the page remains alive; current GUI becomes unusable until manual reconnect | host ping + client bounded reconnect | host WS + GUI client tests |
| Resume grace | PC-01, PC-05; session/execution authority remains runtime-owned | immediate socket-close release destroys conversation state during short transport blips | short in-memory detached lease plus opaque resume capability | ownership, expiry and release tests |
| Preserve safety | PC-05 | reconnect must not widen tool/credential authority or replay model work | resume only existing idle session; cancel in-flight work; reset client allow-all on transport loss | existing approval/cancellation regression + focused tests |
### Minimum Verification Gates

- [x] Host heartbeat emits ping and closes a peer that does not pong within the liveness window.
- [x] Detached idle session is resumable before expiry and released after expiry.
- [x] Invalid resume capability is refused without exposing another session.
- [x] Disconnect during an active prompt aborts/cancels it and does not replay it on reconnect.
- [x] GUI automatically reconnects with deterministic bounded delays and resumes the same session when possible.
- [x] `Allow all` remains transport/session-local and is cleared across reconnect.
- [x] `npm test`, GUI production build and `git diff --check` pass.

## References

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/HOST_PROTOCOL.md`
- `docs/SYSTEMDOC.md`
- `src/gui-host/server.ts`
- `src/gui-host/websocket.ts`
- `gui/src/session/gui-session-client.ts`

## Checklist

- [x] Claim task identity on `main` and create isolated implementation worktree.
- [x] Implement heartbeat and resumable detached-session lease.
- [x] Implement GUI reconnect/resume path with bounded backoff.
- [x] Add focused host/protocol/client regressions.
- [x] Run full verification and review safety boundaries.
- [x] Update owning docs, archive, handoff and restore current-task template.

## Decisions and Notes

- Grace is intentionally short and in-memory only; host restart still ends sessions.
- Resume capability is renderer/host protocol data, never model context or durable memory.
- Active prompt transport loss cancels the turn; only idle session state is resumable.

## Verification

- [x] `npm test`: 543 core, 4 membership and 129 GUI tests passed with zero failures.
- [x] `npm --prefix gui run build` passed (TypeScript + production Vite build).
- [x] Focused GUI-host suite: 38/38 passed, including protocol heartbeat, silent-peer timeout, same-session resume, invalid capability and expiry.
- [x] GUI regressions prove bounded auto-reconnect, no in-flight prompt replay, resume refusal fallback, and `Allow all` reset across transport loss.
- [x] Existing repository-tool approval/cancellation tests remained green; no provider, memory or tool semantic surface was added.
- [x] No live provider call or `.env.local` credential was used by verification.
- [x] Final `git diff --check`, staged credential scan and production build passed immediately before commit.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/HOST_PROTOCOL.md`
- [x] `docs/FILESTRUCTURE.md` reviewed; no source-path/structure change required

## Finalize When Complete

- Archive under `docs/finished/A008-0092_mobile-websocket-recovery.md`.
- Restore `docs/CURRENT_TASK.md` from template.
- Write `docs/handoffs/A008-0092.md` and append signed journal entry.
## Completion

- Outcome: standalone mobile WebSocket recovery is implemented with protocol heartbeat, an opaque short-lived resume lease and bounded GUI reconnect.
- Security: resume capability is in-memory bearer authority only; active work is aborted and never replayed; explicit close/expiry/host shutdown invalidate the lease.
- Follow-up: durable reload/cross-device resume, connected-session idle timeout and global session caps remain out of scope.
