# Current Task

Task ID: A008-0178
Parent Task: A008-0177
Status: Ready
Owner: Rickard (operator)
Created: 2026-09-24
Last updated: 2026-09-24
Charter frozen at: 2026-09-24

## Task Summary

Expose A008-0177's isolated Git worktree sessions in the A008 GUI, including their observable Git state, explicitly confirmed lifecycle actions, and the configurable root that owns worktree clones.

## Task Charter

### Goal

Allow an operator to create, inspect and explicitly manage parallel chat-sessions per project workspaces from the GUI.

### Primary Deliverable

Authenticated host/session API and GUI project details surface for parallel workspaces and their settings.

### In Scope

- Persist a configurable absolute worktree-root setting outside project repositories.
- Expose project worktree creation, listing and Git status through.
- Show branch, base, path, changed-file count and commits-ahead in GUI project details.
- Add explicit confirmation before merge, create-PR, keep and discard choices.
- Binding a running chat/tool session to a worktree cwd.
- Remote push, PR creation, or branch deletion.
- Github integrations settings

### Out of Scope

- Automatic merge.

### Definition of Done

- An operator can configure a workspace root, create/list an isolated session, inspect its state, keep it, or cleanly discard it.
- GUI shows the specified branch/base/workspace/status/ahead information and requires confirmation for lifecycle choices.
- Merge and PR controls Git/remote mutation.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `4b46890`

It's a rather minor task. No other governance / restrictions apply.

### Minimum Verification Gates

- [ ] Typecheck and production build pass.
- [ ] Focused workspace-store/host tests pass.
- [ ] GUI tests and GUI build pass.
- [ ] `git diff --check` passes.

### Verification Budget

- Live verification purpose / required provider behavior: Not needed; fixture Git only.
- Budget owner / parent allocation: A008-0178.
- Policy revision / inherited or explicit approved limits: TASK_WORKFLOW current policy.
- max_live_verification_cost (amount + currency): 0 SEK.
- max_live_verification_calls (all physical attempts): 0.
- max_input_tokens_per_call / max_output_tokens_per_call: 0 / 0.
- live_call_timeout_seconds: 0.
- Approved provider/model routes / credential-source references: none.
- Price reference and checked-at / billing units / currency conversion / allowance: not applicable.
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance: 0 / 0 / 0 / 0 / 0.
- Worker allocations or serialized dispatch; resume retains prior usage: local only.

## References

- `docs/finished/A008-0177_parallel-project-worktree-sessions.md`
- `src/runtime/project-workspace-store.ts`

## Checklist

- [ ] Add bounded host persistence/routes over A008-0177.
- [ ] Add GUI workspace session/status/settings surface.
- [ ] Add focused tests.
- [ ] Update system documents, journal, archive and handoff.
- [ ] Run required verification.

## Decisions and Notes

- Merge and Create PR are confirmation-gated.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state: Ready.
- Next recommended step: -
- Blockers: none.
- Child tasks: none.
- Resume condition: repository state.
- Open questions: none.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task. template: template_CURRENT_TASK.md
- Append a signed `docs/JOURNAL.md` entry.
