# A008-0124 — integrate CRT scanline overlay

Task ID: A008-0124
Parent Task: none
Status: In Progress
Owner: mrWhite81 (operator)
Created: 2026-09-17
Last updated: 2026-09-17
Charter frozen at: 2026-09-17

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `gui/src/app.tsx`
- `gui/src/brand/a008.css`
- `gui/src/brand/themes.css`

## Task Summary

Add the requested CRT presentation effect at the existing A008 application-shell
boundary. The effect must be opt-in through `data-crt="true"` on `.a008-app`,
remain non-interactive, and use existing theme tokens where practical.

## Task Charter

### Goal

Provide a clean, opt-in CRT scanline/phosphor presentation layer for the GUI
without changing application behavior or introducing a separate overlay component.

### Primary Deliverable

The A008 shell exposes `data-crt="true"` and `gui/src/brand/a008.css` renders a
full-shell scanline overlay plus restrained text/icon glow in that mode.

### In Scope

- Add `position: relative` to the existing `.a008-app` rule.
- Add the CRT `::after` scanline overlay and phosphor selectors in `a008.css`.
- Set `data-crt="true"` on the root `.a008-app` element in `gui/src/app.tsx`.
- Keep the overlay `pointer-events: none` and above the shell content.

### Out of Scope

- New user settings or persistence for CRT mode.
- Changes to memory behavior, provider/runtime behavior, or the graph model.
- Changes outside the GUI shell/brand implementation except this task record.

### Definition of Done

- `.a008-app[data-crt="true"]::after` covers the shell with scanlines.
- The overlay cannot intercept input.
- Existing app layout and theme tokens remain intact.
- Typecheck/build or the narrowest available static verification is run and
  limitations are recorded.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: current repository revision reviewed 2026-09-17

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Shell-level CRT overlay | PC-06; preserve the existing A008-owned GUI boundary and supported presentation controls | The requested GUI presentation cannot be enabled at the application shell and would require ad hoc per-pane styling | One data attribute plus one pseudo-element and scoped selectors in existing shell CSS | Search/diff review plus GUI typecheck/build if dependencies permit |

## Minimum Verification Gates

- [ ] Confirm the attribute is on `.a008-app`.
- [ ] Confirm overlay positioning, z-index and pointer passthrough.
- [ ] Run available GUI validation and `git diff --check`.

## References

- `docs/PROJECT_BRIEF.md` PC-06
- `gui/src/app.tsx`
- `gui/src/brand/a008.css`

## Checklist

- [x] Archive A008-0123 and write its handoff.
- [x] Allocate A008-0124 and activate this charter.
- [ ] Add shell attribute and CRT CSS.
- [ ] Validate and record results.

## Verification

- Pending implementation.

## Handoff and Follow-ups

- Current state: charter activated; implementation pending.
- Next recommended step: implement the scoped shell changes and run GUI checks.
- Blockers: dependency availability is not yet rechecked.
