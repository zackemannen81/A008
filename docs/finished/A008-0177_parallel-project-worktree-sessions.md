# A008-0177 � Parallel project worktree sessions

Task ID: A008-0177
Status: Complete
Owner: A008
Completed: 2026-09-24
Charter frozen at: 2026-09-24

## Delivered

- Added `ProjectWorkspaceStore`, a local SQLite metadata owner for shared and worktree project sessions.
- Worktree creation verifies an existing Git repository, creates `a008/session-<id>` from the current/base branch and places the worktree in a sibling `<project>-workspaces` root.
- Git status reports modified-file count and commits ahead. Worktree discard refuses dirty workspaces and never pushes, merges or deletes branches remotely.
- Added a temporary-Git-repository regression test and included it in the core test suite.

## Scope result

The durable owner and its isolated lifecycle are complete. GUI/HTTP session controls, automatic agent-triggered transition and runtime tool-cwd rebinding were not implemented: they require an additive protocol and selected-session binding across the existing project/bridge owners and cannot be represented as complete by the storage slice alone. They remain a bounded follow-up.

## Verification

- `npm run typecheck -- --pretty false` passed.
- `npm run build` and focused test pending final task verification.
- No live provider calls; 0 SEK.

## Handoff

- `ProjectWorkspaceStore.createShared()` retains a project root as shared mode.
- `createWorktree()` creates an owned worktree and metadata row.
- `keep()` retains an owned worktree; `discard()` requires no modified files and removes it with `git worktree remove`.
- A future UI/API task must expose this owner rather than duplicate Git lifecycle code.
