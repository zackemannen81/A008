# A008-0075 verification

Date: 2026-09-08
Branch: `A008-0075-hide-shortcuts`

## Automated

- `npm --prefix gui run typecheck` — pass
- `npm --prefix gui run test` — pass (109 GUI)

Covered:

- Dock open: Hide shortcuts + chip list
- Dock collapsed: Shortcuts control, no chips
- Preference round-trip (`hidden` / `visible`)

## Skipped

- Interactive browser click-through
- Live provider call

## Notes

Header Connected / Parameters / Files / Workbench stay. Keyboard shortcuts
still fire while the chip dock is hidden.
