# Task A008-0048 — GUI chat transcript auto-scroll

Status: Complete
Owner: Operator
Created: 2026-09-03
Completed: 2026-09-03
Branch: `claude/A008-0048-gui-chat-autoscroll`

## Reported symptom

Chat output did not follow new streamed content.

## Actual cause

Not the chat pane. Its scroll-to-bottom effect was already correct, and it fired
on every render. It wrote `scrollTop` to an element that never overflowed.

`.a008-app` declared `min-height: 100%`. That is a floor, not a cap, so the
`grid-template-rows: auto 1fr` second track grew to fit its content. Measured in
a real browser at a 720px viewport with a 60-line streamed answer:

| Element | Before |
| --- | --- |
| `.a008-app` computed height | 3088px |
| grid rows | `54px 3034px` |
| `.a008-chat-transcript` clientHeight | 2605px |
| `.a008-chat-transcript` scrollHeight | 2605px |
| `scrollTop` during streaming | 0, unchanged |
| document overflows viewport | yes |

`clientHeight === scrollHeight` is the whole defect: the transcript could not
scroll, so the window scrolled instead and `scrollTop` was a no-op.

## Change

`.a008-app` now uses `height: 100%` and `overflow: hidden`. One declaration.
No TypeScript changed: the pane's effect and its `stickToBottom` logic were
already right and work as written once the grid is capped.

## Verification

Measured in a real browser against a live GUI host, a real `A008-acp`
subprocess, and a fake provider streaming a 60-line answer.

| Check | After |
| --- | --- |
| `.a008-chat-transcript` clientHeight | 237px |
| `.a008-chat-transcript` scrollHeight | 2605px |
| `scrollTop` during and after streaming | 2368px, pinned at the bottom |
| distance from bottom | 0px |
| document overflows viewport | no |
| transcript overflows | yes |

The other half of correct auto-scroll was verified too: with the reader scrolled
up to 400px, a second answer arrived and grew the transcript from 2605px to
5143px while the view **stayed at 400px**. Returning to the bottom resumed
sticking, within the pane's existing 48px threshold. A 1px sub-pixel remainder
is why that threshold exists.

Suite: `npm --prefix gui run test` 75 pass, 0 fail (72 baseline + 3),
`npm --prefix gui run typecheck` and `build` clean.

## The guard, and its honest limit

`gui/src/brand/shell-layout.test.ts` asserts the declaration, not the layout.
Only a browser can prove a layout, and this repository has no browser test
runner, so a CSS regression here would otherwise be silent. The test says so in
its own comment rather than implying more coverage than it has.

## Scope note

`gui/src/brand/` belongs to A008-0037 under ADR 0019 D7. The shell grid is
consumed by `gui/src/app.tsx`, which the operator owns, and the defect was in
that shared layout rather than in brand styling. Taken as an operator fix.
