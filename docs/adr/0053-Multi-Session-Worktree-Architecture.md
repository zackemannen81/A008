# ADR 0053 — Multi-Session Worktree Architecture (v1 Parallel Project Sessions)

Status: Accepted

Date: 2026-09-24

Decision owner: mrWhite81

## Context

To support multi-agent execution and parallel developer workflows within A008 without causing file-system conflicts, dirty state overlaps, or file-locking collisions, the application requires isolated workspace environments for parallel sessions. 

Modifying code directly in a single shared repository directory prevents running simultaneous agent tasks. Conversely, wholesale cloning of large repositories creates unnecessary disk overhead and disconnects sessions from the shared project context. Git worktrees provide light-weight, native workspace isolation while sharing the underlying object store (`.git`), making them the optimal foundation for parallel project sessions.

## Decision

A008 will implement isolated multi-session project environments (v1) using Git worktrees with the following topology, configuration contracts, and UI integration:

### 1. Conversation and Worktree Topology
- **Conversation without writable execution:** May exist without a workspace for research, planning, or chat.
- **Writable conversation:** Writable execution atomically provisions one dedicated Git worktree and isolated tracking branch, then durably binds that workspace to the conversation.
- **Primary checkout:** Remains the operator/base workspace and merge target. It can be used only through an explicit shared/read-only mode; it is never an implicit mutable fallback when writable provisioning fails.

Project
??? Conversation A
?   ??? no workspace until writable execution is requested
??? Conversation B
?   ??? workspace: worktree B
?       ??? branch: a008/session-B
??? Conversation C
    ??? workspace: worktree C
        ??? branch: a008/session-C

### 2. Configuration & Path Management
- **A008 Root Directory (Session Root Path):** A configurable application setting (`a008.sessionRootPath`) specifying where worktrees are created (e.g., `<project-root>/.a008/worktrees/` or a custom directory).
- **Automated Lifecycle:** Writable execution provisions `git worktree add -b a008/session-<id> <path> <base-branch>` before the conversation is exposed as writable. Provisioning failure fails that writable transition or leaves an explicit recoverable state; it never silently rebinds to the primary checkout.

### 3. UI Display Contract
A008 UI will prominently display the session context header in active session viewports:

Branch: a008/session-7f31
Base: main
Workspace: C:...\7f31
Status: 3 modified files
Commits ahead: 2


### 4. Session Termination & Merge Workflows
When a user or agent completes a session, A008 presents a modal with a **Confirmation Alert** offering four discrete resolution paths:

1. **Merge into main:** Merges `a008/session-<id>` into `main`, removes the worktree, and deletes the session branch.
2. **Create PR:** Pushes the session branch to remote and opens/prepares a Pull Request.
3. **Keep branch:** Detaches the active worktree directory but preserves the Git branch `a008/session-<id>` for manual inspection/resume.
4. **Discard workspace:** Force-deletes uncommitted changes, removes the worktree, and deletes the session branch.

## Alternatives considered

### Single Shared Directory with Stash Management
Rejected because concurrent agents writing files simultaneously cause immediate file corruption, build failures, and race conditions.

### Full Repository Cloning
Rejected because cloning duplicate copies of large repositories uses excessive disk space, slows down session startup times, and makes branch synchronization cumbersome compared to native Git worktrees.

## Consequences

- A008 core runtime must resolve process current working directories (CWD) from the conversation/workspace binding for each execution.
- Git operation utilities must handle worktree cleanup failures gracefully (e.g., locked files on Windows environments).
- Memory extraction (`A008 Knowledge Extractor`) will tag extracted claims with their originating session branch.