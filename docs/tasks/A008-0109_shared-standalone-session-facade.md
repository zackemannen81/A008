# A008-0109 - Shared standalone session facade

Task ID: A008-0109
Parent Task: A008-0103
Status: Ready
Owner: Codex (operator)
Created: 2026-09-15
Charter frozen at: 2026-09-15

## Frozen charter
Goal: standalone and engine clients use one project runtime/session composition,
with fixed session bindings and exclusion of competing legacy runtime owners.
Deliverable: standalone in-process bridge over the shared session owner, exact
legacy data/configuration binding and process guards covering CLI/direct ACP.
Scope: reuse EngineHost session/tool/control/cancellation behavior without panels;
registry resolution for explicit standalone configuration; borrowed registry
injection; v1 workspace switching closes its bridge sessions only; shared-runtime
sessions are independent; all local runtime factory paths honor process leases.
Out of scope: V2 endpoints/auth, durable chat, new reconnect semantics, SDK/native,
storage migration and changing v1 lazy namespace initialization. Strict existing
V2 attachment keeps its separate no-create API; missing V2 data must fail later.

## Necessity Gate
Contract: PROJECT_BRIEF at 5dea080; PC-01 shared engine, PC-04 durable knowledge,
PC-05 tool/credential boundaries, PC-06 controls; ADR 0041 decisions 1-5.
Standalone currently spawns a separate runtime on workspace selection, preventing
shared ownership and leaving direct legacy processes able to bypass registry
leases. Omitting migration permits competing cached writers and global selection
to escape a session binding. Smallest approach: use the existing EngineHost
session implementation as a reusable facade, optional panel creation, a fixed
project bridge adapter and guarded factory composition. Preserve registered IDs,
global SQLite namespace choice, disabled-memory mode and source root in place.
Verify two bridges/projects, wrong-session rejection, shared memory after close,
seed/reopen, existing v1 real-host behavior and CLI/ACP process conflicts.

## Definition of done / gates
- Default standalone host uses shared owner without a per-workspace subprocess;
  custom/borrowed ACP panels keep their compatibility and permission ownership.
- Sessions cannot be used through another project bridge; closing one bridge
  releases its sessions/tools and leaves other borrowers and project memory alive.
- Legacy registered/default SQLite/source configuration and memory-off behavior
  are preserved; no copying, empty replacement or heuristic project-ID change.
- Runtime acquisition/release covers direct CLI/ACP and registry engines, including
  failures; existing seeded data and synthetic actual process conflict checks pass.
- Full npm test, root/GUI build, installed protocol, portable engine proof pass.
- Owning docs, final necessity review, archive/handoff, links/fences/hash/template
  and diff pass; authorized push/PR/merge followed by operator journal.

## Mutable progress
- [ ] Implement shared session adapter and standalone binding.
- [ ] Cover legacy runtime ownership and verify compatibility.
- [ ] Finish docs/archive/template, publish and journal integration.
