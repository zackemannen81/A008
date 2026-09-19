# A008-0124 — integrate CRT scanline overlay

Task ID: A008-0124
Status: Complete
Owner: mrWhite81 (operator)
Created: 2026-09-17
Completed: 2026-09-17

## Outcome

The A008 application shell now exposes the opt-in CRT presentation layer through `data-crt="true"`. The existing shell CSS provides scanlines, pointer passthrough, theme-controlled opacity, and restrained phosphor glow.

## Verification

- `npm --prefix gui run typecheck` passed.
- `npm --prefix gui run build` passed; existing Rollup dependency-annotation and bundle-size warnings remain.
- `git diff --check` passed.
- Static review confirmed absolute positioning, full-shell coverage, `z-index: 9999`, and `pointer-events: none`.

## Follow-up

Visual bloom and success-colored action controls are handled by child task A008-0125.
