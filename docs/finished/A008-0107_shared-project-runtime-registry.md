# A008-0107 - Shared project runtime registry

Task ID: A008-0107
Parent Task: A008-0103
Status: Complete
Owner: Codex (operator)
Created: 2026-09-14
Charter frozen at: 2026-09-14

## Frozen charter
Goal: give engine and future host facades one reusable project-runtime owner with
explicit existing-data attachment and deterministic in-process ownership/lifetime.
Deliverable: concrete registry used by EngineHost, preserved ACP/panel behavior,
strict existing-store attachment and ownership/identity regression evidence.
Scope: canonical cwd aliases, unchanged engine hashed layout/legacy factory,
strict existing SQLite namespace/source binding, same-process competing owner
rejection, injected shared registry borrowing, shutdown and failed initialization.
Out of scope: V2 endpoints/auth, standalone facade migration, cross-process locks,
new storage/migrations, sessions/recovery redesign and native UI. These remaining
stage-2 obligations must stay visible; this child alone cannot complete stage 2.

## Necessity Gate
Contract: PROJECT_BRIEF at c1ba4c6; PC-01 one shared engine, PC-04 durable knowledge,
PC-05 ownership/permission boundary, PC-06 existing controls; ADR 0041 decisions 1-3.
EngineHost currently hides creation/cache/disposal in its private project method.
A new client facade must reuse that owner or risk opening competing cached writers
and selecting a new empty store. Smallest sufficient approach: extract the concrete
factory/cache, preserve engine resolution, add explicit validated existing binding
and injectable borrowing. Test alias/concurrent reuse, distinct projects/sessions,
binding collision, seeded namespace attachment/reopen, failure cleanup and close.

## Definition of done / gates
- EngineHost uses registry and its existing protocol/panel behavior passes.
- Explicit attachment requires existing canonical paths and the intended namespace;
  conflicting bindings fail before mutation; aliases reuse the exact runtime.
- Multiple borrowers do not close a shared runtime; owner disposal closes once and
  refuses active sessions/new work during shutdown. Failed opens release claims.
- Meaningful registry tests, full npm test, root/GUI build, installed protocol and
  portable engine proof pass; no provider calls/user data changes.
- Owning docs, archive/handoff, necessity review, links/fences/diff/template pass.
- Owner-authorized push/PR/merge, followed by operator journal/current docs.

## Mutable progress
- [x] Implement registry and engine adapter.
- [x] Verify ownership, existing data and supported consumers.
- [x] Finalize documentation/archive/template and publish for integration.

## Verification and final review (2026-09-15)

Five new registry tests plus three existing engine tests pass: canonical aliases,
concurrent reuse, independent namespaces, seeded existing attachment/reopen,
pre-creation binding rejection, failed-open cleanup and borrowed disposal.
The shared-file test caught that incremental evidence need not write meta counters;
attachment now also recognizes artifacts and namespace initialization records.
Full npm test: 581 core + 4 membership + 161 GUI = 746, zero failures/skips.
Root and GUI builds pass; GUI retains existing 532.56 kB / 161.06 kB gzip chunk
and dependency annotation warnings. Installed protocol proof and extracted
portable engine discovery/ACP/panel/history/tool/upload/memory/stop proof pass
using temporary data and synthetic providers. No live provider or host restart.
Necessity rechecked against unchanged PC-01/04/05/06 and ADR 0041; final diff
stays within registry/engine ownership. Stage 2 remains incomplete.
Docs links/fences, frozen plan hash, archive/template identity and diff pass.
