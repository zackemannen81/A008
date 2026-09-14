# A008-0109 - Shared standalone session facade

Task ID: A008-0109
Parent Task: A008-0103
Status: Complete
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
- [x] Implement shared session adapter and standalone binding.
- [x] Cover legacy runtime ownership and verify compatibility.
- [x] Finish docs/archive/template, publish and journal integration.

## Verification and final necessity review

Full npm test: 587 core + 4 membership + 161 GUI = 752, no failures/skips.
New evidence covers fixed-project/foreign-session refusal, independent chat
histories, shared project knowledge after bridge close, abort isolation, two
real hosts borrowing a memory-off runtime, and actual CLI/ACP factory processes
respecting registry leases in both directions. Existing seeded/reopen, project
bootstrap, real-host tools/permissions and v1 contract tests pass.
The model-restart regression exposed early engine control activation; the
adapter now selects via the established model control. Follow-up compiled ACP,
engine/panel and bridge tests (7) pass after explicit environment-based catalog
resolution was preserved for in-process composition. Root/GUI builds, installed
protocol and portable engine proof pass; GUI warnings unchanged at 532.56 kB
main chunk / 161.06 kB gzip. No live provider calls or running-host restart.
Final scope/necessity review matches PC-01/04/05/06 and ADR 0041. The existing
EngineHost implementation is reused with optional panels, avoiding a second
chat/tool owner. V1 lazy configured initialization and strict existing attachment
remain distinct. No storage migration or V2 availability is claimed. Stage 2
is complete; V2 transport/auth is next. Docs links/fences, frozen plan hash,
archive/template identity and diff checks pass.
