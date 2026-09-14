# A008-0099 - preserve authenticated GUI host requests

Task ID: A008-0099
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Last updated: 2026-09-14
Charter frozen at: 2026-09-14

## Task Charter

### Goal

Keep a valid standalone PIN session authenticated when the GUI loads workspace
status or uploads a source through its existing host clients.

### Primary Deliverable

Shell and upload requests send same-origin cookies, preventing the observed
successful Connect -> workspace HTTP 401 -> page reload loop.

### In Scope

- Replace cookie omission in the two existing host request clients.
- Regression checks for authenticated requests and existing engine headers.
- Verify Connect and project selection in the owner's authenticated browser.
- Update owned documentation, archive and handoff; rebuild the local renderer.

### Out of Scope

- Auth recovery, PIN policy, host access controls, WebSocket/session behavior.
- Provider calls, private data uploads, deployments, pushes or merges.

### Definition of Done / Minimum Verification Gates

- GUI tests and production build pass.
- Relevant PIN host tests pass.
- The running authenticated GUI stays connected after workspace reads and
  project selection; no PIN 401/reload loop.
- Same-origin request policy and engine header regressions pass.
- Final necessity review, diff check, archive, handoff and template restoration.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md Core Product Contract
Contract revision: d385151

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Preserve PIN cookie on shell and upload | PC-05 explicit credential boundaries and PC-06 supported controls/source intake; ADR 0019 D3/D4/D6, ADR 0031 host-owned workspace observations, SYSTEMDOC standalone PIN gate | Connect succeeds but automatic workspace reads omit cookies and trigger auth recovery; uploads have the same omitted-cookie defect | Set credentials to same-origin in the existing two fetch calls; retain engine headers and all host checks | Client regressions, existing PIN tests, authenticated browser Connect and project selection |

## Evidence and Notes

- Reproduced in the owner's localhost:8787 browser: WS open, session/new/ok,
  two POST /v1/shell 401 responses, pagehide, fresh page, projects GET 200.
- executeShellCommand explicitly uses credentials: omit. The status effect runs
  when a session becomes ready. Recovery sees the resulting PIN 401 and redirects
  to /; that root request includes the still-valid cookie and serves the app again.
- uploadSource contains the only other explicit cookie omission in gui/src.
- Temporary diagnostics record only paths/statuses and WebSocket message types
  in generated HTML. Remove them before completion. No provider call is needed.
- Earlier isolated tests omitted PIN authentication and therefore missed this
  interaction. Tests must exercise cookie policy and the authenticated browser.

## Verification

- GUI suite: 160 passed, including authenticated shell/upload through auth recovery
  and actual expiry still rejected. Existing engine capability recovery checks pass.
- PIN host regression: 3 passed; GUI production build/typecheck passed.
- Owner's localhost browser: reproduced before fix; Connect stayed ready after fix.
  Existing project opened from idle without the original reload loop.
- Project selection while already connected exposed a separate existing stale-session
  close failure. It changes session lifecycle and is routed to bounded A008-0100.
- Source upload verified with synthetic client fixtures only; no private upload.
- No provider call, host restart, push, deployment or main integration.
- Generated browser diagnostics removed by clean production build.
- Final necessity review: only two cookie-policy changes and their regression checks;
  same-origin retains the PIN boundary and does not send cookies cross-origin.
- git diff --check passed.

## Documentation Updates

CURRENT_STATUS and SYSTEMDOC; existing module locations remain unchanged.
Journal entry belongs to operator integration on main.

## Handoff

Cookie fix complete. Continue A008-0100 for connected project switching.
Archive: docs/finished/A008-0099_host-auth.md.
Handoff: docs/handoffs/A008-0099.md.
