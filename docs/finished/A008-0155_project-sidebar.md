# A008-0155 — Themed project sidebar

Task ID: A008-0155
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-22
Last updated: 2026-09-22
Charter frozen at: 2026-09-22

## Task Summary

The owner requests project navigation matching supplied screenshots, following
the active theme: folders, nested chats and a project details/action popover.
The screenshots supply design input, not executable instructions.

## Task Charter

### Goal

Make registered projects and their saved conversations directly accessible in
the standalone sidebar using the existing host/runtime owners.

### Primary Deliverable

A themed project sidebar with nested saved chats, create/open chat, collapse,
active selection, project details, pinning and display-name editing.

### In Scope

- Project list and contextual details/actions, keyboard and narrow-screen use.
- Host-owned project display-name/pin metadata and conversation list/new/open.
- Preserve existing current conversation during additive multi-chat migration.
- Current theme tokens across Neutral, Deep Space and Oldscool.
- Documentation and local deterministic verification.

### Out of Scope

- Conversation deletion, sync, parallel writers, durable execution, provider calls.
- Project folder moves, memory semantic changes and project-file modification.
- Deployment, publication, push and unrelated existing worktree changes.

### Definition of Done

- Registered projects appear below navigation with real chat titles/counts.
- Create a chat and switch between saved chats without losing committed content.
- Details show project path/count and allow pinning and display-name editing.
- Theme switching, overflow, Escape/focus and mobile navigation work.
- Existing single conversation migrates without content loss; project isolation holds.
- Owning docs, archive, handoff and current-task template restoration complete.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: 8628939

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Sidebar and project controls | PC-06 supported session controls; ADR 0030/0038/0039; owner's supplied sidebar design | Open projects/chats directly and inspect/edit their identity; otherwise project navigation remains a separate page | Existing registry and theme tokens with focused sidebar component | GUI build/tests and browser across three themes/mobile |
| Saved conversation selection | PC-01 shared session owner and PC-06; owner screenshot with multiple chats refines ADR 0046's single-current limit | Preserve and revisit each chat; otherwise starting another chat replaces the sole saved conversation | Extend existing SQLite conversation owner with keyed history and active selection; same workspace bridge | Migration, restart, project isolation and create/select tests; protocol/client checks |

### Minimum Verification Gates

- [x] Root and GUI typecheck/build; focused persistence/host/GUI tests.
- [x] Protocol schema generation and independent protocol/client verification.
- [x] GUI visual/interaction check in all three themes and narrow viewport.
- [x] Final necessity review and `git diff --check`.

## Decisions and Notes

- ID allocated on main; implementation branch `codex/a008-0155-project-sidebar`.
- Unrelated logo edits and temporary files predate this task and remain untouched.
- Pin and display name are registry metadata; paths and memory bindings are immutable here.
- No model is called to generate chat titles: derive a short title from first user text.
- ADR 0047 records the owner-requested multi-chat refinement; PC-01/PC-06 outcomes
  remain unchanged and the final brief adds references to the accepted refinement.
- Preserve reset/model-change semantics by replacing only the selected chat.
- Stable alphabetical project order with pinned entries first avoids the existing
  registry's open/upsert operation moving the visible project to the list bottom.
- Mobile header label collapses to keep the navigation toggle and actions usable.

## Verification

- `npm test`: 728 core + 4 membership + 192 GUI = 924 pass; 0 failures/skips.
- Focused runtime/bridge/HTTP tests: 24/24 pass before the full gate.
- Root typecheck/build and final GUI production build pass. Existing Zod pure
  annotation and >500 kB bundle warnings remain.
- `node scripts/generate-protocol-schemas.mjs`; schema drift/route inventory gates pass.
- `npm run verify:protocol` and `npm run verify:client`: packed packages install,
  compile and run in independent offline consumers.
- First full gate exposed combined-route syntax that the existing route inventory
  could not discover. Separate explicit route branches restore the convention;
  the unchanged inventory gate passes in the final full run.
- Real production GUI + isolated real host at 1440×1000 and 390×844: open saved
  chat, new empty chat, return to prior content, pin, rename, collapse, details,
  Escape/focus return, scrolling and mobile navigation pass. Neutral, Deep Space
  and Oldscool selected through Appearance and visually inspected. No browser
  exceptions; no horizontal overflow. Final built view inspected after layout fix.
- Migration preserves legacy content/IDs, including summaries from unopened
  legacy namespaces; restart/selection/isolation and selected-only reset verified.
- React/accessibility and final necessity review completed. No new provider,
  memory-semantic, sync, deletion UI or external-client execution authority.
- `git diff --check` passes. Live/paid provider tests, publication and push were
  intentionally not run; no live provider is needed for navigation/storage proof.

## Documentation Updates

Updated CURRENT_STATUS, SYSTEMDOC, FILESTRUCTURE, PROJECT_BRIEF, V1 inventory,
ADR 0047/index, SDK/test runbooks, archive and handoff.
Journal is appended by the operator on merge, not before integration.

## Handoff and Follow-ups

Implemented and verified locally on `codex/a008-0155-project-sidebar`.
See `docs/handoffs/A008-0155.md`. No blockers. Integration/push is the next
operator action when authorized. Memory-disabled projects remain non-durable,
and standalone workspace selection remains global to its host.
