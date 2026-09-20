# A008-0147 — Project conversation session restore

Task ID: A008-0147
Parent Task: None
Status: Ready
Owner: ChatGPT (operator)
Created: 2026-09-21
Last updated: 2026-09-21
Charter frozen at: 2026-09-21; contract revision `97cf8c2`

## Task Summary
Opening a registered project currently closes the standalone GUI workspace session and creates a fresh empty session. Restore the project's latest canonical committed conversation instead.

## Goal
When the standalone GUI opens/reopens a registered project, reconstruct that project's current conversation and continue from it.

## Primary Deliverable
A project-scoped durable current-conversation snapshot owned by runtime/session code and hydrated into the standalone workspace session.

## In Scope
- Record the durability refinement: project conversation durability is separate from ACP/V2 session durability.
- Persist one current workspace conversation per project in the existing SQLite file.
- Persist conversation identity, model and canonical committed messages, including generated-image parts.
- Restore it on project reopen and host restart.
- Keep generic ACP/V2 new sessions fresh and independent.
- Model change starts and persists a new empty conversation.
- Persist reset, undo, turns and image terminal transitions.
- Never replay stale pending paid image generation; restore it terminal/non-replayed.
- Keep renderer derived from session snapshot.

## Out of Scope
- MCP server/tool configuration or lifecycle.
- Decoupling assistant-final from post-output memory work/activity animation.
- Multiple named conversations per project.
- Durable ACP/V2 session IDs, resume capabilities, receipts, tools, thoughts or permissions.
- Offline/cross-device sync or concurrent writers.
- Provider/memory architecture redesign.

## Definition of Done
- A→B→A restores A's ordered transcript and does not leak it to B.
- Restart + reopen restores committed transcript under a new ephemeral session ID.
- Model change/reset/undo persist resulting state.
- Completed images restore in place; stale pending image never triggers provider execution.
- Generic ACP/V2 sessions remain fresh.
- Full tests/build/diff checks pass.

## Necessity Gate
Contract: `docs/PROJECT_BRIEF.md`, PC-01 and PC-06.
Contract revision: `97cf8c2`.
Accepted direction: operator instruction 2026-09-21; ADR 0042 project ownership; ADR 0045 canonical multimodal conversation. ADR 0041's old no-durable-chat boundary must be narrowly refined.

Smallest sufficient change: store one project-namespaced canonical conversation in the existing SQLite owner and opt only the standalone workspace session into restore.

## Decisions and Notes
- Persist conversation state, not transport-session authority.
- One current conversation per project is sufficient.
- Reuse existing SQLite; no localStorage or second transcript database.
- Reasoning/tool wire state is not durable chat.
- MCP work is concurrent but separate.

## Checklist
- [x] Identity claimed on main.
- [x] Charter frozen Ready.
- [ ] Record narrow durability ADR.
- [ ] Implement persistence/hydration.
- [ ] Wire standalone workspace restore only.
- [ ] Add focused tests.
- [ ] Run full verification.
- [ ] Update docs/archive/handoff and restore CURRENT_TASK.

## Verification
Not run yet.
