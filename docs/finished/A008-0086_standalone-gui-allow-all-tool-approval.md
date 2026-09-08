# Current Task

Task ID: A008-0086
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: 2026-09-08

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/HOST_PROTOCOL.md`

## Task Summary

Add the owner-requested third standalone GUI tool-permission choice: `Allow all`.

## Task Charter

### Goal

Let the operator approve all subsequent model tool requests for the current GUI session without repeated dialogs.

### Primary Deliverable

A third `Allow all` action in the standalone permission dialog with session-scoped auto-approval.

### In Scope

- Standalone GUI permission client state and dialog.
- Reset auto-approval when a new GUI session/socket is opened.
- Focused tests and owning documentation.

### Out of Scope

- Persistent/global approval across sessions or restarts.
- Host/ACP protocol expansion or permission bypass from model content.
- Engine/native-client permission policy changes.

### Definition of Done

- Dialog offers Reject, Allow once, Allow all.
- Allow all approves the current request and later requests in the same session automatically.
- A new connection/session requires approval again.
- Existing explicit permission boundary remains intact and tests pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: b9cfe1a68cac6e1ad9392acd5496ed41e4aeedac

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Session-scoped Allow all | PC-05 — explicit execution boundary; owner explicitly selects the policy | Repeated tool work on mobile otherwise requires one modal per call; model/content still cannot grant execution | Keep protocol boolean; store operator choice only in GUI client session and auto-send existing allow response | GUI client test: current + later request allowed, reconnect resets |

### Minimum Verification Gates

- [x] `npm --prefix gui test` — 119 passed, 0 failed.
- [x] `npm test` — core 531/531, membership 4/4, GUI 119/119.
- [x] Diff review confirms no persistent/global bypass and no protocol expansion.

## References

- `gui/src/session/tool-permission-dialog.tsx`
- `gui/src/session/gui-session-client.ts`
- `docs/PROJECT_BRIEF.md` PC-05

## Checklist

- [x] Claim task identity and freeze bounded charter.
- [x] Implement session-scoped allow-all state.
- [x] Add regression coverage.
- [x] Update owning documentation.
- [x] Verify, archive, hand off, restore template, commit and push.

## Decisions and Notes

- `Allow all` is intentionally browser-session scoped, not written to settings or memory.
- Existing `{ allow: boolean }` host frame remains canonical; this is a client-side operator policy.

## Charter Amendment Log

- none

## Verification

- [x] Review actual changes against the necessity arguments and frozen scope.
- [x] `git diff --check` passed.
- [x] Production GUI bundle contains `Allow all`; the same asset returned 200 through `https://a008.audioleaf.se`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] `docs/HOST_PROTOCOL.md`

## Handoff and Follow-ups

- Current state: Complete; bundled standalone GUI offers Reject, Allow once, Allow all.
- Next recommended step: none; operator may use Allow all for a connected session.
- Blockers: none
- Child tasks: none
- Resume condition: n/a
- Open questions: none

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from the template.
- Append a signed `docs/JOURNAL.md` entry.
