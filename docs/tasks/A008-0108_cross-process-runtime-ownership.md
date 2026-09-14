# A008-0108 - Cross-process runtime registry ownership

Task ID: A008-0108
Parent Task: A008-0103
Status: Complete
Owner: Codex (operator)
Created: 2026-09-15
Charter frozen at: 2026-09-15

## Frozen charter
Goal: prevent separate registry-backed engine processes from opening competing
cached runtime owners, with safe release after normal exit or process death.
Deliverable: filesystem-backed lifetime exclusion in ProjectRuntimeRegistry and
real subprocess evidence preserving independent namespaces and existing data.
Scope: canonical SQLite namespace ownership; short identity-initialization guard;
normal close, failed initialization and crash cleanup; unchanged engine layout.
Out of scope: standalone facade migration, direct legacy CLI/ACP composition,
V2/auth/recovery, database migration and distributed/network filesystem locking.
Those unconverted owners remain a documented deployment limitation until the
facade task routes them through the guarded boundary before V2 publication.

## Necessity Gate
Contract: PROJECT_BRIEF at 158ab39; PC-01 shared engine, PC-04 durable knowledge,
PC-05 execution boundary; ADR 0041 decisions 1-3. In-process maps cannot exclude
a second engine process caching the same namespace. Omitting lifetime exclusion
leaves competing owners and stale cached knowledge. Smallest sufficient approach:
use existing SQLite OS-backed locking on separate local lock files, not a second
state database or PID/stale-file heuristic. Serialize sidecar initialization,
hold one namespace lease until runtime disposal, never delete a live lock path.
Verify two actual processes, aliases, independent namespaces, abrupt termination,
reopen, and failed-initialization release with synthetic temporary data.

## Definition of done / gates
- Competing registry process fails before runtime factory/storage mutation.
- Different namespaces remain usable in the same SQLite file; canonical aliases
  cannot bypass ownership; initialization cannot race sidecar selection.
- Closing or killing the owner permits a later opener without manual cleanup.
- Full tests, root/GUI build, installed protocol and portable engine proof pass.
- Necessity review, owning docs, archive/handoff, links/fences/diff/template pass.
- Owner-authorized push, PR, merge and operator journal update.

## Mutable progress
- [x] Implement guarded registry ownership and subprocess evidence.
- [x] Verify supported consumers and finish documentation.
- [x] Archive, restore template, push/PR/merge and journal.

## Verification and final review

Three subprocess tests pass: canonical alias conflict before factory creation;
normal exit and forced process death followed by same-identity reopen; independent
seeded namespaces in one SQLite file; simultaneous first-open identity selection.
Existing failed-initialization tests also verify lifetime lease release on error.
Full npm test: 584 core + 4 membership + 161 GUI = 749; no failures/skips.
Root/GUI builds, independent installed protocol and extracted portable engine
proof pass. GUI warnings/chunk size remain unchanged (532.56 kB, gzip 161.06 kB).
No live provider calls, user-data migration or running-host restart.
Final necessity review matches PC-01/04/05 and ADR 0041; only registry-backed
processes are guarded. Legacy owner coverage remains a visible prerequisite
for combined deployment/V2. Docs links/fences, plan hash, archive/template and
diff checks pass.
