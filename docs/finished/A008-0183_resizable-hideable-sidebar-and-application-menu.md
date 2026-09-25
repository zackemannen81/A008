# Current Task

Task ID: A008-0183
Parent Task: None
Status: Complete
Owner: Rickard (operator)
Created: 2026-09-25
Last updated: 2026-09-25
Charter frozen at: 2026-09-25

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant accepted top-level records under `docs/adr/`; never use `docs/adr/_legacy/` as current authority

## Task Summary

The current workspace shell has a fixed desktop sidebar and page/action header. The operator needs a desktop-app-like top menu, a visibly resizable sidebar, and an explicit way to hide or restore it without changing the established theme typography or colours.

## Task Charter

### Goal

Make desktop workspace navigation controllable through a resizeable, hideable sidebar and expose normal application menus in the top chrome.

### Primary Deliverable

A renderer-local shell update with accessible File, Edit, View and Help menus; sidebar resize cursor/drag behavior; and an always reachable sidebar show/hide control.

### In Scope

- Add a top application menu bar matching the requested File, Edit, View and Help structure.
- Add a desktop sidebar splitter with visible horizontal-resize affordance, bounded pointer/keyboard resize behavior and persistent local width.
- Add hide/show sidebar control and restore behavior while retaining mobile navigation behavior.
- Preserve existing fonts, colour tokens, pages, host contracts and session/runtime ownership.
- Add focused GUI coverage and update current-state documentation.

### Out of Scope

- New commands, filesystem behavior, native/Electron menus, keyboard shortcut remapping, theme/typography/colour changes, project-sidebar behavior changes, settings relocation, skills, and host/runtime/protocol changes.

### Definition of Done

- Desktop users can drag the sidebar boundary with a resize cursor, keyboard-resize it, and its bounded width is restored locally.
- Desktop users can hide and restore the sidebar without losing the current page; mobile navigation remains usable.
- The header exposes File, Edit, View and Help menus with only existing supported UI actions.
- Existing visual tokens and font declarations are unchanged, relevant tests/typechecks pass, and no host authority changes occur.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `8684c6bff37d712bb48f0617aac98abf0c2a166c`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Sidebar resize and visibility | PC-LF-01; local operator controls remain usable without an A008-hosted backend | Operator cannot adapt the local workspace navigation to project size or hide it for focused work | Renderer-local shell state, CSS custom property and bounded pointer/keyboard splitter; no host persistence | Focused state/DOM/layout guards |
| Application menu bar | PC-LF-01; local operator controls | Existing actions are fragmented and the requested familiar desktop menu entry points are absent | Renderer-local menus routing only existing actions | Focused DOM/action tests and source review |

### Minimum Verification Gates

- [ ] Root and GUI typechecks pass.
- [ ] Focused GUI tests and established GUI suite pass or documented unrelated failures remain.
- [ ] Final review confirms no font, colour token, host, runtime or protocol behavior changed.

### Verification Budget

- Live verification purpose / required provider behavior: not needed; renderer-local behavior only.
- Budget owner / parent allocation: A008-0183.
- Policy revision / inherited or explicit approved limits: TASK_WORKFLOW live-verification budget; zero use.
- max_live_verification_cost (amount + currency): 0 SEK.
- max_live_verification_calls (all physical attempts): 0.
- max_input_tokens_per_call / max_output_tokens_per_call: 0 / 0.
- live_call_timeout_seconds: 0.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: none.

## References

- `docs/PROJECT_BRIEF.md` PC-LF-01.
- `gui/src/app.tsx` and `gui/src/brand/workspace.css`.

## Checklist

- [x] Claim task ID and freeze charter.
- [x] Inspect shell action ownership and add renderer-local menu/sidebar controls.
- [x] Add focused tests.
- [x] Verify, update authority docs, archive, handoff and restore the current-task template.

## Decisions and Notes

- “Flytta upp” is implemented as a conventional top application menu bar using File, Edit, View and Help, as shown in the supplied reference image.
- Menu entries invoke only existing renderer actions; unavailable native operations are not fabricated.

## Charter Amendment Log

- none

## Verification

- [x] Review actual changes against frozen necessity arguments and scope: renderer-local menu and sidebar behavior only; no host/runtime/protocol, typography or theme-token changes.
- [x] `npm run typecheck`; `npm --prefix gui run typecheck`; focused shell/sidebar tests 6/6; full GUI suite 207/208; `git diff --check` passed.
- [x] Skipped/failed: full GUI suite retains pre-existing `gui/src/settings/parameters-panel.test.ts` root-relative source-path failure; no unrelated repair was absorbed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` not needed; no new top-level responsibility directory.
- [x] ADRs and collection indexes not needed; no durable architecture decision.

## Handoff and Follow-ups

- Current state: Complete; renderer-local shell controls are ready.
- Next recommended step: claim a separate skills-management slice if still desired.
- Blockers: the unrelated existing Parameters test path defect remains.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: none.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task. template: template_CURRENT_TASK.md
- Append a signed `docs/JOURNAL.md` entry.
