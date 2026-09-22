# A008-0161 — Platform durable work store

Task ID: A008-0161
Parent Task: A008-0160
Status: Complete
Owner: Codex GPT-5.6 Terra (worker)
Created: 2026-09-22
Charter frozen at: 2026-09-22 after main claim d4ebfa6; executed at reviewed contract baseline `86466edd4ec5e119e42d22a2d669d83078b90b47`.
Branch: codex/a008-0161-platform-durable-work-store
Clone: C:/code/A008-workers/A008-0161-platform-durable-work-store

## Frozen goal and deliverable

A real SQLite-backed `PlatformStore` and internal types implementing the
accepted `PLATFORM_V3_CONTRACT` durable responsibilities, with a small typed API
for the future host coordinator and signatures/examples in
`docs/platform/STORE.md`.

## Frozen scope

`src/platform/**` (without host integration), `test/platform-store.test.ts`, the
one root `package.json` membership addition, `docs/platform/STORE.md`, this
archive, and its handoff. Memory semantics, provider/tool execution, V1/V2,
dependency upgrades, live calls, merge and global status/system/map/index files
were out of scope.

## Necessity Gate

Authority: PC-07 (durable background platform), PC-01 (shared owners), PC-05
(explicit authority), and ADR 0048. Without a durable scoped store P1 cannot
safely persist or expose work independent of a client. The smallest sufficient
implementation uses the existing TypeScript, SQLite and Zod stack with no new
service or engine. It verifies actual acceptance/recovery/fencing cases rather
than only a schema happy path.

## Completed behavior

- SQLite owns scoped conversations, messages, runs, command receipts and body-free
  outbox events without opening or mutating knowledge tables.
- Atomic admission checks matching command replay before revision/busy checks;
  a payload conflict or failed admission creates no partial state.
- One nonterminal conversation writer, revision checks, lease generation and
  expiry fencing, safe pre-dispatch requeue and dispatched uncertainty blocking
  are enforced locally.
- Answer/message/conversation/run/event commit is atomic. Memory outcome is a
  later separate status, and a running cancellation is only a request: a known,
  guarded answer may still win the terminal transition.
- Reads are tenant/project scoped, messages are bounded at 10,000 with admission
  reserving answer capacity, event paging is bounded at 1000, future schema is
  rejected and a closed store rejects operations.

## Verification

- `npm run typecheck` — pass (local implementation).
- `npm run build` — pass (local implementation).
- `node --test dist/test/platform-store.test.js` — pass, 4 tests / 4 assertions
  groups using temporary SQLite fixtures and independent reopen.
- `npm run test:membership` — pass, 4 tests / 4 assertions groups.
- Live provider verification: not run; task allowance was 0 SEK and 0 calls.

## Integration boundary

This is storage only. It does not make `/v3`, host integration, background
execution or client-disconnect behavior available. The operator owns integration
and the associated CURRENT_STATUS, SYSTEMDOC, FILESTRUCTURE and JOURNAL updates.
