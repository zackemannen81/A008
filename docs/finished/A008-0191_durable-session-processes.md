# A008-0191 — Durable session processes

Task ID: A008-0191
Parent Task: None
Status: Complete
Owner: Codex (operator), requested by Rickard; completion by ChatGPT after Codex limit exhaustion
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
moves, Git merges/deletions, remote services or provider changes.

## Definition of Done

All ten ADR 0055 acceptance criteria have implementation/evidence: separate
worktrees/branches/processes; disconnect independence; read without process start;
new instance after death; single process/run ownership; ordered reconnectable
stored events; no replay of unknown effects; missing-worktree refusal; shared
semantic owner and scoped workspace observations; history without semantic memory.
Compatibility/migration boundaries are explicit. Root/GUI, protocol/client,
real child-process and host integration gates are recorded below.

## Necessity Gate

Contract revision: `0a8903bc9b9b0e44a6563dbecd356fc3ef669a35`.

| Change | Authority | Need / consequence of omission | Smallest sufficient approach | Verification |
| --- | --- | --- | --- | --- |
| Session children and ownership | PC-LF-05/08/09; ADR 0055 | In-process objects violate process isolation/reuse | Host-held process registry, local child IPC, stable session plus replaceable instance identity | Real child reuse/crash/concurrency tests |
| Shared memory boundary | PC-LF-03/04; ADR 0055 | Child must not open competing project memory owners | Host memory service over instance-bound IPC with workspace/revision context | Shared-owner and scoped-observation regression |
| Durable workspace/identity | PC-LF-05/06/07 | Session must own its branch/base and never silently rebind | Persist session/workspace mapping and verified base commit; explicit legacy read-only boundary | Worktree, restart and missing-workspace tests |
| Reconnect and permissions | PC-LF-07/09; ADR 0055 | Observers otherwise lose activity; crash may repeat effects | Ordered stored activity, explicit controls and conservative effect review | Snapshot/cursor, permission, disconnect and kill tests |

## Delivered

- Durable session identity is independent of OS process identity. A session keeps
  its workspace/history while a `SessionProcess` gets a new `instanceId` and PID
  after death or explicit stop.
- New durable project sessions own isolated Git worktrees/branches. Session
  opening is history-only; process creation happens when work is submitted.
- The host owns project runtime and semantic memory. Session workers use typed
  local IPC for model/tool work, retrieval and post-output memory operations.
- Public activity is stored with cursors and snapshot handoff for reconnectable
  observation. Client disconnect/navigation does not cancel accepted work.
- Unknown dispatched effects are never replayed implicitly. New work can proceed
  in a replacement process while dependent effects remain blocked until explicit
  review.
- Missing/discarded workspaces never fall back to the project root. The durable
  run state now records `WORKSPACE_MISSING`; protocol/OpenAPI/client contracts all
  accept that explicit error state.
- Legacy V1/V2/ACP and unbound durable data remain explicit compatibility or
  migration boundaries rather than competing session identities.

## Verification

All checks are local fixtures/local implementation checks on 2026-09-27. No live
provider calls; cost 0 SEK.

- `npm run build:client`: PASS (`@a008/protocol` and `@a008/client` build).
- `npm run build`: PASS.
- `npm run verify:protocol`: PASS; packed protocol installed and executed in an
  independent offline consumer.
- `npm run verify:client`: PASS; packed client + protocol installed and executed
  in an independent offline consumer.
- `node --test --test-force-exit dist/test/platform-store.test.js
  dist/test/project-workspace-store.test.js dist/test/session-process.test.js`:
  **10/10 pass**.
- `node --test --test-force-exit dist/test/platform-host.test.js`: **13/13 pass**.
  This includes crash/replacement, background navigation/disconnect, concurrent
  sessions, cancellation, memory failure separation, process ownership and
  missing-workspace refusal.
- Focused ADR 0055 crash/replacement/missing-workspace lifecycle: **1/1 pass**
  after introducing `WORKSPACE_MISSING` consistently through runtime and V3.
- `npm --prefix gui test -- --run`: **215/215 pass**. One pre-existing brittle
  source-format assertion for File/Edit/View/Help was made whitespace-tolerant;
  product menu behavior was unchanged.
- Protocol schemas/OpenAPI regenerated after the new error code.
- `git diff --check` and final root/GUI typechecks are part of closure.

## Checklist

- [x] Read owners, inspect baseline and allocate local identity.
- [x] Inventory surfaces and freeze IPC/migration mapping before implementation.
- [x] Implement workspace/session process and memory boundary.
- [x] Persist public activity and expose process state/control.
- [x] Verify ADR acceptance, compatibility and negative paths.
- [x] Update owners, archive, hand off and restore CURRENT_TASK.

## Notes

Codex completed and pushed the major implementation in `ac0ce45` and `6d1267b`
before its weekly session limit was exhausted. Completion resumed from those
published checkpoints; no work was reconstructed from chat memory.

During completion the missing-workspace regression exposed a half-finished error
contract: coordinator emitted `WORKSPACE_UNAVAILABLE`, which was not allowed by
the V3 run schema and therefore turned a correct failed run into HTTP 500/invalid
response. The final state is `WORKSPACE_MISSING` end-to-end.

## Handoff

See `docs/handoffs/A008-0191.md`. Owning current-state documentation is updated,
and `docs/CURRENT_TASK.md` is restored from the repository template before the
closure commit.
