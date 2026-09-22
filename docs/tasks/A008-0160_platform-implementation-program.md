# A008-0160 — Platform implementation program

Task ID: A008-0160
Parent Task: None
Status: In Progress
Owner: Codex (operator/master)
Created: 2026-09-22
Charter frozen at: 2026-09-22 following owner authorization and allocation d4ebfa6

## Goal and primary deliverable

Implement A008 Platform through the bounded P0-P7 and M1-M4 gates in
A008_PLATFORM_SPEC, preserving cognition/memory and ACME boundaries.

## Scope and authority

PC-01/04/05 and new PC-07; ADR 0048 adopts direction. Every child has an explicit
necessity argument and frozen acceptance gates. Operator may allocate, push,
review, merge and update canonical docs. Workers may commit/push/open PR, never merge.
Maximum six workers, further limited to actual runtime slots (three currently).
Use Terra or another user-approved suitable model. Clone root C:/code/A008-workers.

## Out of scope

Unreviewed migrations/deletion, new cost-bearing services, public deployment
without its release gate, altering memory semantics, moving tools into ACME.
Electron remains conditional on a concrete need. Do not invent that need.

## Task graph and gates

| Task/stage | Dependencies | Status | Exit |
| --- | --- | --- | --- |
| P0 adoption/contracts | owner authorization | Complete | ADR 0048 and frozen first-slice contract merged in PR #99 |
| A008-0161 durable store | P0 | Complete | PR #104; SQLite atomicity, scope, lease and corrected cancellation/recovery gates pass |
| A008-0162 wire schemas | P0 | Complete | PR #103; strict V3 schemas, packed consumer and V1/V2 artifact regression pass |
| A008-0163 trusted conversation seeding | P0 | Complete | PR #106; 39 focused tests, no legacy-store writes or semantic replay |
| P1 host/coordinator/client integration | 0161 + 0162 + 0163 | Not started | Real host background execution, scoped auth, polling and restart proof |
| A008-0164 backend integration | 0161 + 0162 + 0163 | Ready | Actual scoped durable background host and process-recovery proof |
| A008-0165 V3 SDK | 0162 | In Progress | Validated independent client, no implicit mutation retry |
| A008-0166 fixture isolation | observed SDK host test failure | Ready | Temporary catalog isolates existing host verification from user MCP config |
| P1 GUI/import/admin closure | integrated host | Not started | Parallel projects, durable chats incl memory-off, migration/restore gates |
| M1 coordination/target adapter | P1 owners | Not started | A25/A27/A29/A30 |
| M2 context governance | M1 | Not started | A26/A31 |
| M3 continuity | P1 + M1/M2 | Not started | A28/A32 |
| M4 economics/audit | execution records | Not started | A33/A37-A40 |
| P2 remote multi-user | P1 | Not started | Platform §24 and A09-A15 |
| P3 hybrid | P1 scoped ownership | Not started | A16-A18 |
| P4 admin/operations | earlier admin contracts | Not started | A19-A21 and self-hosted release |
| P5/P6/P7 clients | stable backend/device | Not started | Actual target-platform gates |
| Electron | concrete integration need | Conditional | Shared contracts and parity |

Allocate/freeze remaining children only when their prerequisite design is concrete.
No conceptual swarm re-proof. Track implementation gaps honestly.

## Coordination and verification

Workers own nonoverlapping source scopes plus task-local docs/tests/handoffs.
Shared canonical SYSTEMDOC/STATUS/FILESTRUCTURE/indexes are operator integration
scope; workers provide precise proposed deltas in their handoff. This explicit
role projection avoids concurrent global-doc edits while requiring operator
updates in the same merged change. Required authority remains available.

Review bounded handoff, exact head and named gates. Request targeted additions
when evidence is missing; no automatic full-transcript retrieval. Merge serially
after dependency alignment and relevant integration checks. Attach every PR.
Journal records actual integrations. CURRENT_TASK on main remains the template.

## Budget

First storage/protocol tasks need no live calls: 0 SEK / 0 calls. Later integration
tasks inherit at most 10 SEK total for each explicitly allocated verification wave,
with disjoint worker allocations. Authoring-agent usage is the user-authorized
worker execution, separate from product live-verification provider probes.

## Necessity and baseline

PC-07 + PC-01/05; omission prevents background multiproject durability requested
by owner. Smallest first wave: compact SQLite owner plus explicit wire boundary,
followed by actual host integration. Baseline main 5b7b395; claims d4ebfa6.
Verify delivered behavior against platform A01-A40 at relevant stage. No global
platform completion claim until required stage gates actually pass.

## Progress

- Canonical main and origin/main verified equal and clean before work.
- IDs claimed and pushed before delegation.
- P0 authority and first wave Ready charters merged through PR #99 at 86466ed.
- Existing runtime inspection identified the bounded trusted-history prerequisite
  A008-0163; it is independent of the storage/protocol workers.
- Initial three isolated Terra workers executed 0161/0162/0163. Canonical baseline
  npm test passes 728 core + 4 membership + 192 GUI, 0 failures. No live calls.
- 0162 merged in PR #103 at 7e63fde after acceptance review. 0165 now executes
  in a new isolated clone. 0161 PR #104 corrections passed targeted verification.
- 0161/0162/0163 are integrated through f9ae0f5. 0164 is now frozen Ready with
  actual storage/seed APIs, scoped auth, limits, failure and process-recovery gates.
