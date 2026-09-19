# A008-0125 — reproduce bloom and green action controls

Task ID: A008-0125
Parent Task: A008-0124
Status: In Progress
Owner: mrWhite81 (operator)
Created: 2026-09-17
Last updated: 2026-09-17
Charter frozen at: 2026-09-17

## Task Summary

Extend the completed CRT presentation with the visible bloom and green action-control treatment requested from `docs/concepts_sandbox/concept.jpg`, while preserving existing interaction behavior and avoiding global recoloring of navigation or quiet buttons.

## Task Charter

### Goal

Make primary action controls read as phosphor-green CRT controls and add a restrained bloom around their text and borders.

### Primary Deliverable

CRT-scoped CSS tokens/selectors that style primary composer and memory action buttons with the existing success color.

### In Scope

- Add CRT-scoped bloom to primary action controls.
- Use existing theme success tokens so Neutral and Deep Space remain distinct.
- Keep quiet, navigation, and text-link buttons unchanged.
- Update the task record and handoff documentation.

### Out of Scope

- Image assets, canvas filters, global button recoloring, or new runtime settings.
- Changes to memory behavior, graph data, or interaction handlers.

### Definition of Done

- Primary composer and memory action buttons are green in CRT mode.
- Hover/focus states retain visible contrast and bloom.
- Quiet buttons and navigation controls are not recolored.
- GUI typecheck/build and `git diff --check` are run when dependencies permit.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-06 — supported user controls and content
Contract revision: current repository revision reviewed 2026-09-17

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| CRT primary controls | PC-06; preserve existing GUI boundaries and supported presentation controls | The requested concept-image presentation lacks the intended action hierarchy and bloom treatment | Existing success token plus CRT-scoped selectors in brand/memory CSS | CSS review, typecheck/build, diff check |

## Minimum Verification Gates

- [ ] Confirm only primary controls receive green styling.
- [ ] Confirm bloom and focus visibility.
- [ ] Run GUI validation and `git diff --check`.

## References

- `docs/concepts_sandbox/concept.jpg`
- `gui/src/brand/a008.css`
- `gui/src/brand/themes.css`
- `gui/src/brand/workspace.css`
- `gui/src/memory/memory.css`

## Checklist

- [x] Archive A008-0124 and write its handoff.
- [x] Allocate A008-0125.
- [ ] Add CRT-scoped green primary controls and bloom.
- [ ] Validate and record results.

## Verification

- Pending implementation.

## Handoff and Follow-ups

- Current state: child task active; implementation pending.
- Next recommended step: implement the scoped CSS and run GUI checks.
- Blockers: the image is available as a reference asset but not rendered by the repository file reader.
