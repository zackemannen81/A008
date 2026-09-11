# A008-0095 GUI tools leak

Task ID: A008-0095
Parent Task: A008-0090
Status: Ready
Owner: Codex (operator)
Created: 2026-09-11
Charter frozen at: 2026-09-11

## Task Summary

Prevent model-tool activity from leaking between prompt cycles in the same GUI session. The live transcript must show only the current session tool list, and the pane-local tool log must not reuse stale activity for a later assistant turn.

## Task Charter

### Goal

Keep GUI tool activity scoped to the active prompt cycle.

### Primary Deliverable

A008 GUI chat transcript and tool log correctly reset and reassign tool activity when a session begins a new prompt cycle.

### In Scope

- Clear the pane-local tool log when the runtime reports an empty tool list for a prompt cycle.
- Ensure stale `pending-assistant` tool entries cannot be reused by a subsequent cycle.
- Add regression coverage for two prompt cycles in one session.

### Out of Scope

- Changes to provider, ACP, host, or tool execution protocols.
- Changes to tool approval semantics or tool catalog contents.
- Broader transcript, memory, theme, bootstrap, or Canvas behavior.

### Definition of Done

- Empty `session.tools` clears stale pane-local tool activity.
- New tool activity renders only under the current assistant turn.
- A two-cycle regression test fails before the fix and passes after it.
- Existing GUI tests and typecheck pass.
- Charter, handoff, and immutable archive are recorded.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: current `main` revision containing the reviewed contract

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Reset stale GUI tool activity between prompt cycles | PC-05 — explicit execution boundary; tool activity remains tied to the established approval/cancellation boundary | A later prompt can display or attribute a previous prompt's tool calls, misrepresenting execution state and weakening the visible approval boundary | Clear the local tool-log ownership when the runtime exposes an empty tool list, and preserve existing current-turn filtering | Two prompt-cycle DOM regression plus existing GUI suite |

### Minimum Verification Gates

- [ ] Focused chat transcript and DOM tests
- [ ] GUI typecheck
- [ ] Full GUI test command
- [ ] Review diff against scope and necessity gate

## Checklist

- [x] Inspect current live transcript and tool-log ownership.
- [x] Reproduce the stale-tool state in a same-session two-cycle case.
- [x] Patch the smallest sufficient reset/ownership behavior.
- [x] Add regression coverage.
- [x] Run focused and full GUI verification.
- [x] Archive task and write handoff.

## Decisions and Notes

- The existing `session.tools` list is authoritative for the currently active tool cycle. An empty list is a reset signal, not a reason to retain old pane-local entries.
- Keep protocol and tool catalog behavior unchanged.

## Verification

- `npm --prefix gui run typecheck` — passed.
- `npm --prefix gui run test -- --test-name-pattern "live tools|empty tool snapshot"` — passed; focused DOM regression included.
- `npm --prefix gui run test` — passed; 156 tests passed, 0 failed.
- Review: the implementation changes only `gui/src/chat/chat-pane.tsx` and adds one DOM regression in `gui/src/chat/chat-pane.dom.test.ts`; no protocol, provider, or approval behavior changed.
- Skipped: full repository test suite; this bounded GUI-only change was verified with the GUI typecheck and complete GUI suite.

## Documentation Updates

- [x] Task charter
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` (operator-owned on merge)
- [ ] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: Complete; empty `session.tools` snapshots clear the pane-local tool log and the two-cycle DOM regression passes.
- Next recommended step: Operator review, branch push, and PR merge under A008 governance.
- Blockers: None known.
- Child tasks: None.
- Resume condition: Not applicable unless review requests changes.
- Open questions: None.
