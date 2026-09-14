# A008-0098 â€” recover expired standalone GUI PIN sessions

Task ID: A008-0098
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Last updated: 2026-09-14
Charter frozen at: 2026-09-14

## Task Summary

Expired standalone PIN sessions currently leave an already-open GUI partially usable while new `/v1/*` HTTP operations fail with raw `401 Authentication required.` errors. Recover that supported auth boundary predictably without weakening it.

## Task Charter

### Goal

Route an expired PIN-authenticated GUI back to the existing login gate when the host explicitly reports that PIN authentication is required.

### Primary Deliverable

One central renderer-side auth-recovery boundary used by the bundled GUI, with focused regressions proving it reacts only to the host's PIN-expiry response.
### In Scope

- Detect same-origin `/v1/*` responses whose status is 401 and whose host error is exactly `Authentication required.`.
- Redirect that browser to `/`, where the existing PIN gate already owns re-authentication.
- Preserve engine-token and unrelated 401 behavior.
- Add focused GUI tests and update owning runtime documentation.

### Out of Scope

- Changing the six-digit PIN contract, cookie TTL, token entropy or edge-auth policy.
- Persisting auth sessions across host restarts.
- Changing WebSocket resume semantics or provider credentials.
- Adding a second auth store, dependency or backend identity system.

### Definition of Done

- Expired PIN HTTP operations no longer surface raw `Authentication required.` inside the GUI.
- Only the exact same-origin host PIN-auth failure triggers navigation to the existing gate.
- Non-PIN 401 responses remain ordinary caller-visible failures.
- GUI typecheck/tests/build, relevant host tests and `git diff --check` pass.
### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `b9cfe1a68cac6e1ad9392acd5496ed41e4aeedac`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Recover expired standalone PIN auth | PC-05 explicit credential/auth boundaries; PC-06 supported GUI controls/content through existing host owners. Existing SYSTEMDOC PIN gate remains authoritative. | A valid supported GUI becomes partially broken after cookie expiry: fresh `/v1/*` actions return a raw auth error instead of re-entering the gate. | Install one renderer-wide fetch response guard that recognizes only the host's exact same-origin PIN-auth 401 and navigates to `/`; reuse the current gate. | Unit-test exact match, unrelated 401, cross-origin response and response-body preservation; run existing PIN host regression. |

### Minimum Verification Gates

- [x] Focused GUI auth-recovery tests pass.
- [x] Existing standalone PIN host tests pass.
- [x] GUI typecheck and production build pass.
- [x] Full GUI suite passes.
- [x] `git diff --check` passes.

## References

- `src/gui-host/pin-auth.ts`
- `src/gui-host/server.ts`
- `gui/src/session/engine-access.ts`
- `gui/src/main.tsx`
- `test/gui-host.test.ts`

## Checklist

- [x] Add central exact-match PIN-auth recovery without consuming caller responses.
- [x] Install recovery before React mounts.
- [x] Add focused regressions.
- [x] Update current status/system/file map and archive/handoff on completion.

## Verification

- `npm --prefix gui run typecheck` passed.
- GUI suite: 159/159 passed, including exact PIN 401 redirect, unrelated/cross-origin 401 preservation, native engine-capability preservation, and caller response-body preservation.
- Existing standalone PIN host regressions: 3/3 passed.
- Full root `npm test`: 564 core, 4 membership and 159 GUI tests passed with zero failures/skips.
- `npm --prefix gui run build` production build passed.
- `git diff --check` passed at completion.
- No live provider call, push, deployment, auth TTL change or host restart was performed.

## Decisions and Notes

- The smallest sufficient fix is renderer-side recovery, not a new auth mechanism: the existing `/` PIN gate remains the sole re-authentication owner.
- The guard requires status 401 plus both exact host fields `error` and `message` equal to `Authentication required.` on a same-origin `/v1/*` request.
- Response inspection uses `response.clone()` so feature clients can still read the original error if navigation does not occur.
- A valid native `#engine=<64 hex>` capability suppresses PIN recovery, preserving the separate engine-panel authorization path.
- The existing 24-hour PIN cookie and process-lifetime random auth token remain unchanged by charter.
