# Task A008-0052 — Workspace shell and design tokens

Status: Complete
Owner: Operator
Parent: ADR 0021
Created: 2026-09-03
Completed: 2026-09-03
Branch: `claude/A008-0052-workspace-shell`

## Change

The three-zone shell from ADR 0021 D1, in A008's own warm-neutral tokens.

- `gui/src/brand/a008.css` — the palette is retuned in place. Token *names* were
  kept, so modules owned by other tasks keep rendering without being edited
  across the ADR 0019 D7 boundary; `--a008-cyan` and `--a008-gold` survive as
  aliases onto the new accent and are marked for retirement by the tasks that
  own those modules.
- The shell grid: `grid-template-rows: auto minmax(0, 1fr)` and three
  `minmax(0, …)` columns, `height: 100%`, `overflow: hidden`.
- `gui/src/workbench/` — a tab strip that mounts exactly one surface.
- `gui/src/app.tsx` — rail, centre, workbench. Terminal and upload became tabs.

## Measured result

Browser, 1280×720 viewport, live host, real `A008-acp` subprocess, streamed
answer:

| | Before | After |
| --- | --- | --- |
| chat transcript height | 237px | **545px** |
| transcript overflows itself | yes | yes |
| document overflows viewport | no | no |
| height cost of an unused tool | fixed, always | none |

Zones at 1280×720: header 1280×54, rail 240×666, centre 592×666, workbench
448×666. 54 + 666 = 720 exactly.

Switching workbench tabs left the transcript at 545px, and exactly one pane is
mounted at a time.

## Decisions

**Token names kept, values changed.** Renaming would have meant editing
`chat-pane.css` and `upload-pane.css`, which belong to other tasks. Retuning in
place changes the whole look through one file, which is also what ADR 0021 asks
of this stylesheet.

**The shell supplies form-row chrome for panes it hosts.** Composer and terminal
got their layout from the stacked-column rules this task removed, so removing
them without replacement left both broken. The replacement lives in the shell
stylesheet and targets their existing class names; their markup is untouched.

**A008's own colours.** `--a008-bg: #0e0f0d`, `--a008-accent: #c0a878`. The
reference uses `#10110f` and `#b29a72`. Same family, different values, chosen
rather than copied — see ADR 0021 D4.

## Verification

| Check | Result |
| --- | --- |
| `npm --prefix gui run typecheck` / `build` | clean |
| `npm --prefix gui run test` | 75 pass, 0 fail |
| Root `npm run typecheck` / `npm test` | clean, 314 pass |
| Browser geometry | measured above |

## Not done

- No behaviour change (ADR 0021 D6). Host protocol, session client, upload route
  and terminal runner are untouched.
- The rail still renders `SettingsPane` as-is. Restyling it into a status
  surface is A008-0055.
- Chat and composer keep their current internals; those are A008-0053 and
  A008-0054.
- Still no automated layout guard beyond the A008-0048 declaration test. The
  numbers above came from a browser, by hand.
