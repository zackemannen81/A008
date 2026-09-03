# Task A008-0052 — Workspace shell and design tokens

Status: Ready
Owner: Operator
Parent: ADR 0021
Created: 2026-09-03
Branch: `claude/A008-0052-workspace-shell`

## Goal

The three-zone shell from ADR 0021 D1, in A008's own warm-neutral token set,
with the overflow discipline applied everywhere rather than only where a bug was
found.

## In scope

- `gui/src/brand/a008.css` — the token set and the shell layout
- `gui/src/app.tsx` — the three zones and the workbench tab state
- `gui/src/brand/brand-mark.tsx` if the mark needs the new accent
- `gui/src/workbench/` — a new module owning the tab strip and pane frame

## Out of scope

- Any behaviour change. Host protocol, session client, upload route and terminal
  runner are untouched (ADR 0021 D6).
- The internals of `gui/src/chat/`, `composer/`, `terminal/`, `upload/` and
  `settings/`. This task moves where they are mounted, not what they render.
  Their own restyling is A008-0053 onward.
- Copying anything from the reference (ADR 0021 D4).

## Definition of done

- Header is a three-column grid: identity, workspace tabs, runtime status.
- Terminal and upload are workbench tabs, not stacked panes, so an unused
  surface costs no vertical height.
- The conversation occupies the centre and is the tallest thing on screen.
- Every grid track is `minmax(0, …)` and every pane sets `min-width: 0`,
  `min-height: 0` and its own overflow.
- `gui/src/brand/a008.css` is the single token source; no other file declares a
  colour literal.

## Minimum verification gates

- [ ] Measured in a real browser at a 720px viewport with a streamed answer: the
      transcript is taller than it was at 237px, still overflows within itself,
      and the document does not scroll.
- [ ] Switching workbench tabs does not change the conversation's height.
- [ ] `npm --prefix gui run typecheck`, `build` and `test` clean.
- [ ] Root `npm run typecheck` and `npm test` still green.
