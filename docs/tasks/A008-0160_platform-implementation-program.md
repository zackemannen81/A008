# A008-0160 — Platform implementation program

Task ID: A008-0160
Parent Task: None
Status: In Progress
Owner: Grok (operator/master); prior operator Codex
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
| P1 host/coordinator/client integration | 0161 + 0162 + 0163 | Complete | PR #111 at 3716b44 plus merged V3 SDK #108. GUI closure remains the next P1 row |
| A008-0164 backend integration | 0161 + 0162 + 0163 | Complete | PR #111 at 3716b44. Operator rerun store+host 16/16, including real process restart |
| A008-0165 V3 SDK | 0162 | Merged | PR #108 at 1cf318e. Operator: verify:client pass, focused SDK 6/6. Real-host V2 regression remains 0166 |
| A008-0166 fixture isolation | observed SDK host test failure | Complete | PR #110 at a690141. Operator rerun V2 host 2/2. Worker full suite 745+4+192. Secrets-path limit backlogged |
| P1 GUI/import/admin closure | integrated host | Partial | Surface and admin CLI are merged. Explicit import/migration remains unreviewed |
| A008-0167 bundled platform surface | 0164 + 0165 | Complete | PR #113 at 2afaaf2. Operator rerun GUI 204/204 plus production build |
| A008-0168 platform admin CLI | 0164 + 0165 | Complete | PR #112 at d057c22. Operator rerun CLI host tests 2/2. No retry and no new route |
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
- Grok succeeded Codex as operator. 0165 merged through PR #108 without a worker
  archive or handoff. Operator rechecked verify:client and focused SDK tests 6/6
  on main 1cf318e. No live calls. Occupied clones
  `A008-0164-platform-local-backend`, `A008-0165-platform-client` and
  `A008-0166-host-fixture-isolation` hold uncommitted files and are not the
  continuation baseline.
- A008-0166 merged through PR #110 at a690141 after operator rerun of the V2
  real-host file, 2/2, on head 2537f1a. `A008_SECRETS_PATH` remains unset in
  that fixture and is backlog, not part of 0166.
- A008-0164 merged through PR #111 at 3716b44. Operator reran platform store
  and host tests 16/16 on head eaecebd, including the real child-process
  restart. No live provider call. P1 GUI closure is the next unfrozen row.
- A008-0167 and A008-0168 claimed at 36be3af and frozen Ready. They add a
  bundled V3 page and a four-command admin CLI. ADR 0048 D8 still forbids
  silent migration and replacement of V1 chat.
- A008-0168 merged through PR #112 at d057c22. Operator reran the CLI host
  tests 2/2 on head b64ef68. `info` exits 0 when the platform is off; resource
  failures exit non-zero. A008-0167 remains in execution.
- A008-0167 merged through PR #113 at 2afaaf2. Operator reran GUI tests
  204/204 on head 1930ea3, including the real-host two-client proof, plus GUI
  typecheck and production build. No browser click-through was available.
  Explicit chat import remains unreviewed.
