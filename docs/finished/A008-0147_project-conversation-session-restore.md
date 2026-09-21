# A008-0147 — Project conversation session restore

Task ID: A008-0147
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-21
Last updated: 2026-09-21
Charter frozen at: 2026-09-21; contract revision `97cf8c2`

## Task Summary

Opening a registered project previously closed the standalone GUI workspace session and created a fresh empty conversation. A008-0147 makes the standalone workspace's one current project conversation durable and reconstructible while preserving ephemeral ACP/V2 session authority.

## Goal

When the standalone GUI opens or reopens a registered project, reconstruct that project's current canonical committed conversation and continue from it.

## Primary Deliverable

A project-scoped durable current-conversation snapshot owned by runtime/session code and hydrated into the standalone workspace session.

## In Scope

- Record the durability refinement: project conversation durability is separate from ACP/V2 session durability.
- Persist one current workspace conversation per project in the existing SQLite file.
- Persist conversation identity, model and canonical committed messages, including generated-image parts.
- Restore it on project reopen and host restart.
- Keep generic ACP/V2 new sessions fresh and independent.
- Model change starts and persists a new empty conversation.
- Persist reset, undo, committed turns and image terminal transitions.
- Never replay stale pending paid image generation; restore it terminal/non-replayed.
- Keep renderer state derived from the session snapshot.

## Out of Scope

- MCP server/tool configuration or lifecycle.
- Decoupling assistant-final from post-output memory work/activity animation.
- Multiple named conversations per project.
- Durable ACP/V2 session IDs, resume capabilities, receipts, tools, thoughts or permissions.
- Offline/cross-device sync or concurrent writers.
- Provider/memory architecture redesign.

## Definition of Done

- [x] A→B→A restores A's ordered transcript and does not leak it to B.
- [x] Restart + reopen restores committed transcript under a new ephemeral session ID.
- [x] Model change/reset/undo persist resulting state.
- [x] Completed images restore in place; stale pending image never triggers provider execution.
- [x] Generic ACP/V2/EngineHost sessions remain fresh.
- [x] Existing reconnect/resume and Stage-4 restart uncertainty guarantees remain truthful.
- [x] Full tests/build/diff checks pass.

## Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01 and PC-06.
Contract revision: `97cf8c2`.
Accepted direction: operator instruction 2026-09-21; ADR 0042 project ownership; ADR 0045 canonical multimodal conversation. ADR 0046 records the later owner-authorized state and supersedes ADR 0041's blanket no-durable-chat statement only for the standalone current-project conversation.

Smallest sufficient change: store one project-namespaced canonical conversation in the existing SQLite owner and opt only the standalone workspace session into restore.

## Decisions and Notes

- The persisted object is conversation state, not transport-session authority.
- One current conversation per project is sufficient; named conversation history remains separate future scope.
- Existing project SQLite is reused; there is no localStorage mirror or second transcript database.
- `ChatSession` can hydrate canonical committed messages but still owns transient active-turn state.
- Workspace `restore` and `fresh` are internal composition modes. Generic EngineHost/ACP/V2 session creation omits them and remains independent.
- Explicit model change uses workspace `fresh`, preserving the existing “model change starts a new conversation” behavior.
- Persistence occurs only at canonical mutations: committed chat send/rollback settlement, reset, successful undo, image reserve and image terminal resolve.
- A persisted stale `pending` generated image is normalized to terminal `cancelled` on load and written back; no provider/tool operation is replayed.
- MCP configuration was implemented independently as A008-0148. After its PR #87 merged, this task rebased cleanly onto that main; no A008-0147 behavior or ownership was moved into MCP code.
- Full-suite first run found two ACP fail-fast regressions because workspace hydration had moved generic chat creation before prompt validation. Creation ordering was repaired so generic invalid content/capability checks still fail before session/provider setup. The only other first-run failure was the existing heartbeat timing test under load; it passed isolated and passed again in the final full suite.

## Verification

- Focused restore/runtime suite: 19/19 pass.
- Explicit A→B→A bridge proof restores the exact committed messages with a new session ID and zero additional provider requests.
- Runtime restart proof restores the same conversation identity/content while transport session identity changes.
- Generic EngineHost session remains empty while workspace durable conversation exists.
- Reset and undo survive close/reopen.
- Completed source-store image locator survives restore.
- Stale pending image restores as cancelled and stays cancelled on the next reopen with no provider call.
- `npm run typecheck`: pass.
- Final post-rebase `npm test`: 707 core + 4 membership + 187 GUI = 898 pass, 0 failures, 0 skipped.
- `npm --prefix gui run build`: pass; only existing Zod annotation and >500 kB chunk warnings.
- `npm run verify:protocol`: pass; packed protocol/dependency installed offline outside A008 and independent TypeScript consumer compiled/ran.
- `git diff --check`: pass.
- No live or paid provider call was made.

## Documentation Updates

- [x] `README.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] ADR 0046 + ADR index
- [x] archive + handoff
- [ ] `docs/JOURNAL.md` — intentionally left for the operator merge entry per `docs/TASK_WORKFLOW.md`.

## Handoff and Follow-ups

- Current state: Complete and verified on `chatGPT/A008-0147-session-restore`.
- Next recommended step: merge this already-rebased branch onto `main`; A008-0148/PR #87 is already included in the verified base and required no conflict resolution.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.
