# Current Task

Task ID: A008-0191
Parent Task: None
Status: In Progress
Owner: Codex (operator), requested by Rickard
Created: 2026-09-27
Last updated: 2026-09-27
Charter frozen at: 2026-09-27

## Goal and Primary Deliverable

Implement ADR 0055 for durable registered-Git-project sessions: replaceable,
exclusive OS session processes, isolated durable workspaces, shared host memory,
and reconnectable history/activity with conservative crash recovery.

## Scope

Host coordinator/process manager; typed local IPC; agent/tool execution in the
session child; host-owned semantic reads/writes; durable identity/activity;
workspace creation naming/base revision; GUI process visibility; compatible
V3 clients; explicit legacy handling; relevant tests and owning documentation.
Generic standalone CLI/ACP compatibility remains available and is inventoried;
it does not become a second durable-session identity. No automatic user data
moves, Git merges/deletions, remote services, provider changes, push or deployment.

## Definition of Done

All ten ADR 0055 acceptance criteria have implementation/evidence: separate
worktrees/branches/processes; disconnect independence; read without process start;
new instance after death; single process/run ownership; ordered reconnectable
stored events; no replay of unknown effects; missing-worktree refusal; shared
semantic owner and scoped workspace observations; history without semantic memory.
Compatibility/migration boundaries are explicit. Root/GUI typecheck, focused real
child-process tests, core/protocol/GUI gates and diff review are recorded.
Owning docs, immutable archive, handoff and restored CURRENT_TASK exist.

## Necessity Gate

Contract revision: 0a8903bc9b9b0e44a6563dbecd356fc3ef669a35.

| Change | Authority | Need / consequence of omission | Smallest sufficient approach | Verification |
| --- | --- | --- | --- | --- |
| Session children and ownership | PC-LF-05/08/09; ADR 0055 | Current in-process objects violate process isolation/reuse | Host-held registry and lease; local child IPC with instance identity; reuse until death/stop | Real two-child, reuse, crash, concurrent-command tests |
| Shared memory boundary | PC-LF-03/04; ADR 0055 | Child must not open competing project memory owners or promote another workspace's observations | Host memory service over instance-bound IPC; workspace/revision context | Shared-owner and cross-workspace regression |
| Durable workspace/identity | PC-LF-05/06/07 | Session must own its branch/base and never silently rebind | Persist session/workspace mapping and actual base commit; explicit legacy read-only boundary | Allocation failure, missing worktree, restart tests |
| Reconnect and permissions | PC-LF-07/09; ADR 0055 | Observers otherwise lose activity; crash may repeat effects | Store ordered public activity; route explicit controls; retain uncertain effects | Snapshot/cursor, permission, disconnect and kill tests |

## Verification Budget

Local process/Git/IPC integration and existing fake provider fixtures verify this
architecture. No external provider behavior changes. Live calls 0; cost 0 SEK;
input/output tokens 0; live timeout 0. No private database migration.

## Checklist

- [x] Read owners, inspect baseline and allocate local identity.
- [ ] Inventory surfaces and freeze IPC/migration mapping before implementation.
- [ ] Implement workspace/session process and memory boundary.
- [ ] Persist public activity and expose process state/control.
- [ ] Verify ADR acceptance, compatibility and negative paths.
- [ ] Update owners, archive, hand off, restore template.

## Notes

Initial main is clean. Work is local on main; user handles commit/push.
0190 is already used by an existing durable-live-stream working branch, so this
allocation avoids collision. Journal append belongs to merge/integration.
