# A008-0167 — Bundled platform conversation surface

Task ID: A008-0167
Parent Task: A008-0160
Status: Ready
Owner: Grok (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after claim 36be3af
Branch: codex/a008-0167-platform-gui-surface
Clone: assigned by the operator outside the canonical tree

## Goal and primary deliverable

Add one bundled GUI page that can list, create and observe opted-in Platform V3
conversations and text runs. Existing V1 chat, project chats and model/reset
behavior stay in place.

## Accepted dependencies

A008-0164 and A008-0165 are merged. Read `docs/platform/BACKEND.md`,
`docs/platform/CLIENT.md`, ADR 0048 decisions D1, D7 and D8, and this charter.
Use `createPlatformV3Client` and the host's existing PIN or device
authentication. Do not invent a principal, cookie or project registry.

## Write scope

- New `gui/src/platform/` page, styles and colocated tests.
- Bounded `gui/src/app.tsx` page state and one navigation control beside the
  existing Memory, Tools and Help controls.
- `docs/platform/GUI.md`, this task record, `docs/CURRENT_TASK.md` while
  working, `docs/finished/A008-0167_platform-gui-surface.md` and
  `docs/handoffs/A008-0167.md`.
- No `src/`, `packages/`, root `package.json`, lockfiles, protocol schemas,
  V1 chat, project sidebar, or migration code.

## Frozen behavior

- The page calls `GET /v3/info` through the SDK. `available: false` renders an
  explicit unavailable state and does not open a database or start a run.
- Resource calls use the same injected fetch and credential adapter style as
  `createGuiSessionClient`. The renderer holds no bearer token.
- When the host PIN profile is enabled, the existing PIN cookie is sufficient.
  When it is not, and no device credential is configured for this client, show
  that platform resources require the existing host login. Do not add anonymous
  V3 access.
- The user selects a project already known to the GUI and may create a V3
  conversation, then one text run. The run uses the chat session's already
  selected model. With no model selected, the action stays disabled.
- Each click mints one `commandId` and keeps it for an explicit retry control.
  The page never auto-retries, never replaces `commandId`, and never cancels a
  run because the page or client object closed.
- Poll events only while the page is active. Render the returned run status in
  text: queued, running, completed, cancelled, failed, and
  `needs_reconciliation`. Color is not the only signal. Theme tokens stay the
  existing ones.
- A second view of the same project sees the committed conversation and run
  after the first client object is discarded.
- V1 transcript, project sidebar, reset and model change are not redirected to
  V3. No import or migration of saved chats. No tools or approvals.

## Necessity Gate

Contract: `docs/PROJECT_BRIEF.md` PC-07, refined by ADR 0048 D1, D7 and D8.
Contract revision: `bda4d6dc1a4f4bb1146f210f9b07db4c97d998cf`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Additive V3 page | PC-07 thin client; ADR 0048 D8 forbids silent migration and V1 replacement | The product GUI can start and observe a durable text run; without it the merged backend has no bundled surface | One page over `createPlatformV3Client` and existing auth | GUI state tests plus one real-host two-client proof |

## Gates

Build and typecheck the GUI. Colocated tests cover unavailable, login-required,
disabled-without-model, queued, running, completed, `needs_reconciliation`,
conflict, and no implicit retry. One real `startGuiHost` proof with a temporary
platform file and the existing loopback provider shows a second client observing
the same run after the first client is closed. Run the GUI test suite and
production build. `git diff --check` passes. Budget is 0 SEK and 0 live
provider calls. Do not load `.env.local`.

Restore `docs/CURRENT_TASK.md` from the template before push. Archive, commit,
push and open a PR. Do not merge. Put canonical status deltas in the handoff.
