# Current Task

Task ID: A008-0181
Parent Task: None
Status: Ready
Owner: A008 (operator)
Created: 2026-09-25
Last updated: 2026-09-25
Charter frozen at: 2026-09-25

## Task Summary

Expose the existing global worktree-root setting in the top-menu Parameters surface while retaining project-specific session actions under the project owner.

## Task Charter

### Goal

Make multi-session configuration reachable from Parameters without moving project-scoped workspace lifecycle controls outside their project authority.

### Primary Deliverable

A Parameters → Parallel sessions panel for reading and saving the existing host-owned worktree root.

### In Scope

- Add a Parameters tab using the existing workspace-settings SDK routes.
- Read and save the absolute worktree root with existing host validation.
- Preserve project-details ownership of create/open/keep/discard actions.
- Add GUI tests and update owning documentation.

### Out of Scope

- Changing worktree storage, routes, validation, runtime ownership, or lifecycle operations.
- Moving project-scoped session actions to a global dialog without an active project.
- File browser/editor, skills, sidebar visibility, browser MCP, merge, push, or PR behavior.

### Definition of Done

- Parameters exposes a Parallel sessions section for the existing workspace root.
- Save/read failures are rendered and do not mutate local state as success.
- GUI tests, typecheck, and diff hygiene pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `df49268`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Parameters-owned global worktree root | PC-LF-01, PC-LF-05, PC-LF-06 | The operator can configure local parallel-worktree placement from the top-level parameters menu; omission leaves an implemented local setting inaccessible in the GUI. Project session actions remain project-scoped. | Use existing typed SDK read/save routes in one Parameters panel; retain the existing project dialog for lifecycle actions. | GUI component/source test, GUI suite, typecheck. |

### Minimum Verification Gates

- [ ] GUI tests.
- [ ] `npm run typecheck`.
- [ ] `git diff --check`.

### Verification Budget

- Live verification purpose / required provider behavior: Not needed.
- Budget owner / parent allocation: N/A.
- Policy revision / inherited or explicit approved limits: N/A.
- max_live_verification_cost (amount + currency): 0 SEK.
- max_live_verification_calls (all physical attempts): 0.

## References

- `docs/PROJECT_BRIEF.md` PC-LF-01, PC-LF-05, PC-LF-06
- `packages/client/src/v1-http.ts`
- `src/gui-host/workspace-routes.ts`
- `gui/src/settings/parameters-panel.tsx`

## Checklist

- [x] Claim task ID on main.
- [x] Freeze charter.
- [ ] Implement Parameters workspace-root panel.
- [ ] Verify and document/archive/handoff.

## Decisions and Notes

- A global root setting has no project identity and belongs in Parameters. Create/open/keep/discard require a project ID and remain project-owned.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against necessity and frozen scope.
- [ ] Record exact checks and outputs.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes

## Handoff and Follow-ups

- Current state: Ready.
- Next recommended step: Implement the Parameters panel.
- Blockers: None.
- Child tasks: None.
- Resume condition: N/A.
- Open questions: None.