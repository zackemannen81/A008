# A008-0185 — Durable Conversation Workspaces and Background Runs

Status: Complete
Owner: Rickard
Completed: 2026-09-26

## Delivered

- Platform V3 conversations persist a required `workspaceId`.
- New writable V3 conversations provision isolated Git worktrees through `GuiWorkspaceStore` before durable creation.
- Accepted runs copy the conversation workspace ID as immutable execution provenance.
- The coordinator resolves run workspace paths durably and uses them as session/tool CWDs while reusing the runtime by project ID.
- Missing, discarded, and migrated `legacy-unbound` workspaces fail explicitly without fallback to a project root.
- Platform GUI conversation rows display workspace identity.

## Verification

- `npm run typecheck` — pass.
- Platform host/store tests — 16/16 pass.
- `npm run verify:protocol` — pass.
- `npm --prefix gui run test` — 209/209 pass.
- `git diff --check` — pass.
- No live provider calls; 0 SEK.

## Documentation

- Updated `docs/SYSTEMDOC.md` and `docs/JOURNAL.md`.
- `docs/CURRENT_STATUS.md` was locked by another process at completion; the final status text is recorded here and in the handoff.

## Limitations

- Legacy V3 rows are deliberately marked `legacy-unbound`; they cannot execute until explicitly reconciled in future work.
- Worktree merge, remote push, PR creation, dirty-worktree cleanup and distributed execution remain out of scope.
