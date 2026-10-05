# Project actions: root chat, parallel chats and project lifecycle

Status: Active draft A008-0211; contract and task-ID claim exist on `origin/main`; local working tree contains unpushed charter changes

## Context

Rickard requested four project-level actions:

1. Open a project's original working directory in the system file explorer.
2. Create/use the project's main chat in that original directory, without a Git worktree.
3. Delete a parallel chat together with its clean associated worktree.
4. Remove a project registration without deleting or modifying its files.

The approved target contract is now explicit in `docs/PROJECT_BRIEF.md` PC-LF-05/06: one durable root/main chat uses the original checkout; parallel chats use isolated Git worktrees. The main chat is not isolated, so the GUI must make its working mode clear.

Destructive actions require a fresh, exact-target Yes in a host-owned native OS dialog, triggered for a request the host has verified as originating from the project's durable main chat. Project unlinking is registration-only. Parallel chat/worktree deletion refuses dirty or unverifiable worktrees and active or unresolved runs.

## Scope boundary

A008-0211 is a separate project-lifecycle program. It does not amend frozen A008-0210, which is paused and specifically removes durable chat history while retaining its workspace. Do not conflate history-only removal, deleting a chat with its worktree, and unlinking a project.

A008-0212 is the prerequisite child for durable root/main identity and host-verifiable one-use confirmation. No destructive implementation may begin until its trust boundary is verified. A renderer-only dialog, client-supplied role, or model text is not sufficient.

## Activation state

IDs A008-0211 and A008-0212, plus the amended PC-LF-05/06 contract, are on `origin/main` at `e407cfa` and the identity claims are recorded in the main task register. The local charters are still uncommitted/unpublished; implementation must follow the Ready/frozen charter workflow and its prerequisite.

## Suggested verification

- Explorer action opens precisely the registered original project directory without mutating it.
- Root/main chat has durable identity, runs only in the original checkout, and has no worktree; parallel chats remain on their own worktrees.
- Chat/worktree deletion covers clean and dirty worktrees, active/unresolved runs, exact-target confirmation, cancellation, expiry/replay and direct unauthorized requests.
- Project unlink removes the registry entry while the directory, repository, files, worktrees and retained session records remain unchanged; re-registration is intelligible.
