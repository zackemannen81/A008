# Multi-agent process layer

Status: Open

## Discovery context

The local optional add-on provides a PowerShell/MCP process supervisor with five
tools. a007 already has repository-level multi-agent policy, but no project-
configured process layer or hard concurrency enforcement.

## Proposed outcome

Decide whether a007 needs the local add-on. If accepted, install/configure it
outside product runtime, select a worker-clone root outside the canonical tree,
and verify isolated process launch, observation, steering, halt, and recovery.

## Why it is not active

Bootstrap needs policy and authority, not a process installation. The current
Codex runtime can coordinate read-only mapping agents without making the add-on
an a007 dependency.

## Dependencies

- Approved worker-root path and client configuration boundary.
- Permission and arbitrary-command security review.
- At least two non-overlapping Ready child tasks for an acceptance wave.

## Suggested verification

- Clean server install, build, and automated tests.
- MCP client lists and calls all five tools.
- Wrong-branch/shared-working-directory/out-of-scope launches refuse.
- Hard concurrency claim is either tested or labeled advisory.
- Repository/Git evidence remains completion authority.
