# A008-0101 — Incremental knowledge persistence evidence

Task: A008-0101
Status: Verified locally
Date: 2026-09-14
Implementation: 27d0dbf00f3a95e1541f6c539dcf7c0a194b7e4f

## Boundary

Only synthetic fixtures, temporary SQLite databases and offline/fake-provider
tests were used. No existing user database was opened or migrated. No live model
call, Docker service change, GUI host restart or deployment was performed.
The accepted L2/L3 lifecycle policies and schema version 4 are unchanged.

## Regression and acceptance

Before implementation, the new reinforcement test failed: one reinforcement
caused 1,412 SQLite changes with 100 fixture entities/lifecycle records and 14,020
with 1,000. The expectation was four. SQLite total_changes includes internal FTS
shadow-table changes; this is a mutation counter, not disk bytes or fsync count.

Final full `npm test`: 569 core + 4 membership + 161 GUI = 734 passing; zero
failures or skips. Root TypeScript build passes as part of that command.
Existing S1-S10, L2 and L3 tests cover reference-engine/restart parity, independent
strength, pure read evaluation, source/receipt rules, concurrency and migration.

Additional regression coverage in
[sqlite-store.test.ts](../../test/knowledge-model/sqlite-store.test.ts):

- Reinforcement mutates exactly four rows for both 100 and 1,000 fixtures.
  Explicit no-op persist and duplicate occurrence replay mutate zero rows.
- Independent edge recurrence mutates exactly three rows and leaves all evidence
  lifecycle values unchanged. Future-time decay evaluation writes nothing.
- A SQL failure inserting audit after baseline/receipt writes rolls back the
  entire operation and restores memory; retry succeeds once, without duplication.
- Entity aliases, semantic labels, slot cardinality, interval/index edits,
  repeated historical FTS entries and removal match bulk storage table by table.
  An unrelated FTS record retains its rowid. Another project namespace survives
  changes/removal; reopening preserves the resulting snapshot.
- A second connection commits immediately after the first releases its write
  lock. The first still rejects stale explicit persist and refreshes before its
  next mutation, preserving both writers' data in runtime and SQLite.

## Repeatable synthetic measurement

Run `npm run build`, then
`node scripts/benchmark-knowledge-persistence.mjs` from the repository root.
The script creates/removes only its own temporary directory. Each size seeds N
entities and N evidence lifecycle records, then reinforces one record repeatedly.
These are storage fixtures, not complete live-chat knowledge graphs.

Both modes use the same context, snapshot capture, transaction boundary and row
serialization. Bulk mode substitutes the retained full-replacement writer;
it is a comparison of write strategies, not a timing of the previous executable.
Setup is excluded; three warmups precede twenty measured operations per mode.
The timed operation includes snapshot work and commit. Modes run sequentially.

Environment: Windows x64, Node v24.14.1, SQLite 3.53.4, on-disk WAL,
`synchronous = 1` (NORMAL), identical settings for both modes.

| Fixture size N | Bulk p50 / p95 ms | Incremental p50 / p95 ms | Bulk changes per operation | Incremental changes |
| --- | --- | --- | --- | --- |
| 100 | 10.93 / 12.30 | 3.75 / 4.52 | 1,423–1,503 | 4 |
| 1,000 | 75.20 / 86.06 | 23.14 / 28.00 | 14,031–14,175 | 4 |
| 10,000 | 859.35 / 883.17 | 247.88 / 292.02 | 140,129–140,537 | 4 |

Bulk ranges grow as receipt/audit history accumulates and FTS maintenance varies.
Incremental SQL mutation count remains constant in this fixture. Timings are
local samples affected by machine load/cache/GC, not a production latency SLA
or proof that chat responses become proportionally faster.

## Remaining limit and necessity review

Snapshot capture, serialization and comparison still scale with project size.
This change removes unrelated SQL writes; it does not introduce engine-wide
dirty tracking, reduce the in-memory knowledge inventory or move retrieval to SQL.
FTS updates operate on changed record groups and preserve historical multiplicity.
Explicit bulk replacement remains for migrations. Future optimization should
measure representative live workloads before adding change tracking.

Final scope satisfies PC-04 with the existing ADR 0018/0035 constraints: smaller
writes preserve durable evidence, associations, provenance, receipts and history.
Commit-boundary revision handling is necessary to preserve the same stale-state
guarantee with incremental FTS writes. No schema, policy, provider, protocol or
client behavior was added.
