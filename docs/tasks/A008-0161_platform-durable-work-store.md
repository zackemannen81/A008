# A008-0161 — Platform durable work store

Task ID: A008-0161
Parent Task: A008-0160
Status: Ready
Owner: Codex GPT-5.6 Terra (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after main claim d4ebfa6; execute only after ADR 0048 integration
Branch: codex/a008-0161-platform-durable-work-store
Clone: C:/code/A008-workers/A008-0161-platform-durable-work-store

## Required context

Read this charter first; then AGENTS required authority and ADR 0048,
PLATFORM_V3_CONTRACT, platform spec §§5–10 and §§21/27 relevant to this task.
Prioritize these bounded sources. Do not load unrelated worker histories.
Current memory owner remains unchanged. Expand context if correctness needs it.

## Goal and primary deliverable

A real SQLite-backed PlatformStore and internal types implementing PLATFORM_V3_CONTRACT durable responsibilities. Expose a small typed API usable by the host coordinator; document signatures and examples in docs/platform/STORE.md.

## Scope

src/platform/** (except no host integration); test/platform-store.test.ts; package.json only adding this test to test:core; docs/platform/STORE.md.
Also own this task record, local CURRENT_TASK during work, unique archive
docs/finished/A008-0161_platform-durable-work-store.md and handoff docs/handoffs/A008-0161.md.

## Out of scope

Other workers' paths, global status/systemdoc/map/indexes (operator integrates
proposed deltas in same PR before merge), memory semantics, runtime provider/tool
execution, V1/V2 changes, dependency upgrades, live calls, merging main.

## Dependencies

ADR 0048 and frozen PLATFORM_V3_CONTRACT merged. No dependency on the other
first-wave worker implementation; communicate only contract mismatches/blockers.
Operator owns cross-surface integration and tests after both PRs meet their gates.

## Definition of done and minimum gates

Real temporary SQLite databases and independent connections/reopen: tenant/project isolation; atomic accept and rollback; one active writer; command replay before busy/revision checks and payload conflict; lease generation/expiry fencing; pre-dispatch recovery vs unknown dispatched outcome; exactly one terminal winner; answer/message/outbox atomicity; independent memory outcome; bounded scoped event paging; future schema rejection; close rejection. Run root typecheck/build, focused test and membership check. No live model needed.
Commit all authorized work, push branch, open PR against main, attach PR using
Codex artifact tool, provide structured handoff; never merge. Restore CURRENT_TASK
byte-for-byte from template before final commit/push. Archive completed charter.
No runtime/HTTP feature claim from this isolated delivery.

## Necessity Gate

Contract: PROJECT_BRIEF PC-07 (durable background platform), PC-01 (shared owners),
PC-05 (explicit authority); accepted ADR 0048. Pin contract commit to the actual
merged P0 baseline before starting; no permission needed for that bookkeeping.
Without this delivery P1 cannot safely persist or expose durable scoped work.
Smallest sufficient approach: existing TypeScript/SQLite/Zod stack, bounded first
contract, no new service or alternate engine.
Verification: exact failure/acceptance cases above, not merely schema happy paths.

## Verification budget

0 SEK, 0 live-provider calls; local implementation and fixtures suffice because
this task makes no provider-wire/capability claim. No credential inspection.
Worker authoring uses the user-authorized Codex worker model.

## Implementation notes

You own root package.json only for adding your test. Do not change dependency versions or lockfiles. Store domain row types are internal projections of the frozen wire vocabulary, not a second semantic model. Accept no arbitrary state replacement bypassing leases. Coordinate any unclear state transition with operator before implementing guesses.
Install dependencies in this isolated clone if needed; no credentials/user data
copied from canonical checkout. Use existing lockfiles. Report environment blockers.
Other paths require operator coordination before edits.

## Handoff contract

Report task/branch/base/head/PR, exact commands and pass/fail counts, observable
acceptance outcomes and fixture/local/live classification, changed paths, known
limitations, public method/export signatures needed by dependent work, and exact
proposed canonical documentation deltas. Never send full transcript/context.
A completed process is not task acceptance.

## Verification

- [x] `npm run typecheck` — pass (local implementation).
- [x] `npm run build` — pass (local implementation).
- [x] `node --test dist/test/platform-store.test.js` — 4/4 pass (temporary
  SQLite fixtures and independent reopen).
- [x] `npm run test:membership` — 4/4 pass.
- [x] No provider calls, credentials, dependency or lockfile changes.

Actual diff rechecked against PC-07, PC-01, PC-05 and ADR 0048: it is limited
to durable platform state and its typed local API. It makes no host, HTTP,
provider execution or semantic-memory availability claim.

## Progress

Implemented and locally verified. Archive and handoff prepared; operator owns
cross-surface integration and global documentation deltas.
