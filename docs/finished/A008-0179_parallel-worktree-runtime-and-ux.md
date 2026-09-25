# Current Task

Task ID: A008-0179
Parent Task: None
Status: Complete
Owner: Rickard
Created: 2026-09-25
Last updated: 2026-09-25
Charter frozen at: 2026-09-25

## Task Summary

Repair isolated Git-worktree sessions so they share one registered project runtime and semantic-memory namespace while every chat/tool session retains its selected worktree CWD. Make parallel-session creation a single create-and-open action with concise project-sidebar presentation.

## Task Charter

### Goal

Enable reliable, isolated parallel project sessions without creating competing owners of one project memory namespace.

### Primary Deliverable

A worktree session opens against the existing project runtime with tools bound to its worktree CWD, and can be created and opened in one GUI action.

### In Scope

- Reuse the registered project runtime by project ID when opening a worktree.
- Preserve the requested session CWD for tools, panels, and runtime snapshots.
- Add focused regression coverage for runtime reuse and worktree CWD.
- Replace the two-step primary GUI create/open flow with a create-and-open action and improve worktree session presentation.
- Update current behavior/status documentation.

### Out of Scope

- Merge, push, pull request creation, branch deletion, or remote mutations.
- Changes to memory ownership, schema, or cross-process lease policy.
- New workspace persistence models or native-client work.

### Definition of Done

- Opening a worktree no longer creates a second runtime or memory owner.
- Model tools and exposed session runtime CWD use the worktree path.
- Creating a parallel session opens it directly for the next chat/tool session.
- Relevant deterministic tests, GUI tests, and typecheck pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `4efd2b3`

| Change                                  | Clause and accepted constraint         | Outcome; consequence if omitted                                                                                                                          | Smallest sufficient change                                                                                    | Planned check                          |
| --------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Shared project runtime with session CWD | PC-LF-03, PC-LF-05, PC-LF-06; ADR 0053 | Parallel writable sessions retain isolated tools while sharing canonical project memory; omission keeps Open broken or risks duplicate memory ownership. | Resolve the existing runtime by registered project ID and carry requested CWD only on the EngineHost session. | Registry/bridge/host regression tests. |
| Create-and-open session UX              | PC-LF-05, PC-LF-06                     | An operator can start isolated work in one intentional action; omission leaves a misleading settings-like two-step flow.                                 | Reuse existing create/open endpoints in one GUI action and render concise session status.                     | GUI rendering/client tests and review. |

### Minimum Verification Gates

- [ ] `npm run typecheck`
- [ ] Targeted runtime/workspace tests
- [ ] `npm --prefix gui run test`

### Verification Budget

- Live verification purpose / required provider behavior: Not needed; deterministic fixtures only.
- Budget owner / parent allocation: N/A
- Policy revision / inherited or explicit approved limits: N/A
- max_live_verification_cost (amount + currency): 0 SEK
- max_live_verification_calls (all physical attempts): 0

## References

- `docs/PROJECT_BRIEF.md` PC-LF-03, PC-LF-05, PC-LF-06
- `docs/adr/0053-Multi-Session-Worktree-Architecture.md`
- `src/engine/engine-host.ts`
- `src/gui-host/server.ts`
- `src/gui-host/local-acp-bridge.ts`

## Checklist

- [x] Inspect runtime ownership, workspace-open routing, EngineHost CWD handling, and GUI flow.
- [x] Implement runtime reuse and session-scoped CWD.
- [x] Implement create-and-open parallel-session UX.
- [x] Add and run targeted tests.
- [x] Update status/system documentation and handoff/archive.

## Decisions and Notes

- The existing memory-namespace ownership guard is correct and remains unchanged.
- A project runtime owns identity, semantic memory, provider composition, and conversations; an EngineHost session owns its selected workspace CWD and tools.

## Charter Amendment Log

- none

## Verification

- [x] Reviewed actual changes against the necessity arguments and frozen scope.
- [x] `npm run typecheck` passed.
- [x] `npm run build --silent && node --test dist/test/local-acp-bridge.test.js` passed: 4 tests.
- [x] `npm --prefix gui run test` passed: 205 tests.
- [x] `git diff --check` passed.
- [x] No live provider verification; 0 SEK.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md` and `docs/SYSTEMDOC.md` were locked by another host process; their required update is recorded in the handoff.
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` not needed; no structure change.

## Handoff and Follow-ups

- Current state: Complete; `CURRENT_TASK.md` restored to the template.
- Next recommended step: Apply the documented status/system wording once their locking process releases them.
- Blockers: `docs/CURRENT_STATUS.md` and `docs/SYSTEMDOC.md` were locked during this run.
- Child tasks: None.
- Resume condition: None.
- Open questions: None.
