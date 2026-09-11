# A008-0095 GUI tools leak

Task ID: A008-0095
Parent Task: A008-0090
Status: Complete
Owner: Codex (operator)
Completed: 2026-09-11

## Outcome

The A008 GUI now clears pane-local tool activity whenever the runtime reports an empty `session.tools` snapshot. Tool activity from a completed prompt cycle cannot remain visible or be reused during the next prompt cycle in the same session.

## Changes

- `gui/src/chat/chat-pane.tsx`: empty tool snapshots reset `toolLog` before later tool activity is assigned to the current assistant turn.
- `gui/src/chat/chat-pane.dom.test.ts`: regression coverage confirms a first-cycle tool entry is absent after the empty reset cycle.

## Verification

- `npm --prefix gui run typecheck` — passed.
- `npm --prefix gui run test -- --test-name-pattern "live tools|empty tool snapshot"` — passed.
- `npm --prefix gui run test` — passed; 156 passed, 0 failed.

## Scope Review

No provider, ACP, host, approval, tool catalog, memory, Canvas, theme, or bootstrap behavior changed.
