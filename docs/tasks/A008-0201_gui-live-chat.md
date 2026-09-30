# A008-0201 — Restore durable GUI live chat

Task ID: A008-0201
Parent Task: None
Status: Complete
Owner: Codex (operator/implementer)
Created: 2026-09-30
Last updated: 2026-09-30
Charter frozen at: 2026-09-30 after local main allocation

## Task Summary

The owner reports disappearing user messages and chunked thought/answer after
the durable background-session transition. Inspection found that the GUI polls
activity every 700 ms and overlays process snapshots onto durable messages,
including snapshots that predate the currently accepted user message.

## Task Charter

### Goal

Restore reliable user-message visibility and prompt live thought/answer updates
without weakening durable background sessions or isolation.

### Primary Deliverable

Race-safe GUI transcript composition and event-driven observation of the existing
host-owned run activity, preserving snapshot recovery and separate channels.

### In Scope

- Keep accepted durable messages authoritative over process snapshots; show an
  outgoing message during submission and reconcile it without duplicates.
- Deliver live activity when the host receives it rather than fixed-interval
  buffering; keep bounded waits, disconnect cleanup, reconnect and stale guards.
- Preserve live image/tool/permission presentation and durable final answers.
- Focused and integration regression tests, documentation, archive and handoff.

### Out of Scope

- Provider/model changes, synthetic token animation, persistent private thoughts.
- Process/workspace ownership changes, new execution scheduler, automatic replay.
- Changes in C:\code\acme or DesktopCommanderMCP, dependency upgrades, publication.

### Definition of Done

- User messages remain visible during queued/running/completed states, including
  stale process snapshots, repeated text, chat switching and submission races.
- Thought and answer updates reach the selected GUI before run completion and
  without the fixed 700 ms polling delay; they remain separate and unduplicated.
- Switching/disconnecting only stops observation. Reconnection restores current
  state, terminal runs use durable history and stale responses cannot cross chats.
- Existing background execution, tool permissions, images and recovery pass tests.

### Necessity Gate

Contract: docs/PROJECT_BRIEF.md
Contract revision: c4d3914

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Transcript reconciliation | PC-LF-05/07/09; ADR 0055 durable history/client observation | Accepted user input stays visible; old process snapshots currently hide it | Durable messages plus validated live suffix and scoped optimistic submission | GUI race tests for stale snapshot/repeated text/failure/chat switch |
| Live observation | PC-LF-08/09; ADR 0055 replaceable processes and observers | Prompt separated live updates without polling chunks; omission keeps regression | Wait on existing host activity with bounded authenticated requests and current-state reconciliation | Real delayed process fixture, multi-client/disconnect and GUI update ordering |

### Minimum Verification Gates

- [x] Root and GUI typecheck/build as needed for changed contracts.
- [x] GUI transcript/client regressions and full GUI suite.
- [x] Host/process integration: pre-completion thought/answer and disconnect behavior.
- [x] Relevant protocol/client compatibility and recovery tests; unrelated existing failures recorded below.
- [x] Final necessity/diff review, documentation, archive/template equality.

### Verification Budget

Local delayed provider and real-process fixtures; no live-provider behavior change.
Live cost/calls/input/output: 0; timeout: 0. Policy revision c4d3914.
No external credentials, publication or changes to concurrently edited ACME checkout.

## Checklist

- [x] Read authority and identify both regression paths.
- [x] Allocate on main, review and freeze.
- [x] Implement and verify.
- [x] Document, archive and restore current-task template.

## Decisions and Notes

- Current base is merged A008-0200 (c4d3914). Keep provider and process ownership.

## Charter Amendment Log

- none

## Verification

Root build/typecheck and GUI build/typecheck PASS. Full GUI suite **222/222 PASS**.
Protocol and client packed independent consumer verification PASS.
Real host/process/recovery suites **31/31 PASS**, including 110-round process
replacement and delayed streaming with ordinary polling set to 60 seconds.
The streaming case was also run independently and passed.

Broader five-suite check: **39/42 PASS**. Three existing failures in unchanged
HTTP/protocol fixtures: visited HTTP route coverage, missing runtime-preferences
literal route inventory, and missing required workspaceId in V3 conversation
fixture. Test files, route registry, V3 schemas and server dispatch are unchanged
from c4d3914. Routed to backlog; no contract relaxed. See handoff for commands.

Final necessity review: all production changes support PC-LF-05/07/08/09 and
ADR 0055 within frozen scope. Permission request coalescing prevents duplicate
decisions from the observer and refresh racing. No new execution ownership,
provider configuration, dependency, private-thought persistence or automatic
submission retry. No live calls, 0 SEK. Browser visual/live-provider checks not run.

## Documentation Updates

SYSTEMDOC, CURRENT_STATUS, JOURNAL, FILESTRUCTURE, relevant ADR/indexes.

## Handoff and Follow-ups

[Handoff](../handoffs/A008-0201.md),
[archive](../finished/A008-0201_gui-live-chat.md).
[Unrelated fixture follow-up](../backlog/http-contract-visited-route-coverage.md).
Complete locally; no remote push or merge claimed. No blocking child task.
