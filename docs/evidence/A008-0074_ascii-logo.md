# A008-0074 verification

Date: 2026-09-08
Branch: `A008-0074-ascii-logo`

## Automated

- `npm --prefix gui run typecheck` — pass
- `npm --prefix gui run test` — pass (106 GUI)
- `npm --prefix gui run build` — pass

Covered:

- Empty chat includes `a008-empty-logo` and the start cards
- Logo is `aria-hidden`
- Art is 57 lines, max 100 columns

## Skipped

- Interactive browser click-through (no browser tools in this session)
- CLI banner (out of scope)

## Notes

Source is the owner file `a008.txt`. The empty pane renders it as a muted
monospace mark with a rule above “What would you like to work on?”.
