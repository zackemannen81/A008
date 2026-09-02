# ADR 0011 — Sequential post-output memory coordination

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

A007 has separate provider-neutral services for reasoning-free proposal staging
and guarded one-proposal relation commit. An application still needs to join
them without implying that a multi-proposal batch is one database transaction.
Earlier proposals may already be canonical when a later classifier or
repository operation fails.

An entity/domain index failure is especially important. The one-proposal
service returns `pending_repair` after canonical truth has committed. Continuing
the batch immediately could let a later proposal compare against incomplete
candidate metadata and incorrectly classify related meaning as new.

## Decision

- `PostOutputMemoryCoordinator` is the provider-neutral application boundary
  above staging and per-proposal relation commit.
- A fresh `process` call allocates a staging input with exactly task ID,
  normalized original message, normalized final answer, and copied caller-
  verified scopes. Runtime extras such as reasoning, completion metadata, or
  routing values are not forwarded.
- Staging is called exactly once. Its returned identity kinds and exact batch
  serialization are revalidated and copied before proposal processing.
- Proposals are committed sequentially in stable zero-based order. The
  coordinator does not parallelize, restage, or claim cross-proposal atomicity.
- The result is explicit:
  - `completed` contains the staged batch and all ordered commit records;
  - `staging_failed` contains the staging error and implies zero commit calls;
  - `commit_failed` contains the failed proposal index plus a checkpoint whose
    next index is the same unprocessed proposal; and
  - `index_repair_required` contains the canonically committed pending record,
    next proposal index, bounded document, and current repair error.
- `resume` validates a commit checkpoint, preserves prior ordered results, and
  retries from exactly its next index without staging or repeating earlier
  proposals.
- A `pending_repair` result stops the batch. `repairAndResume` validates that
  the pending document matches the latest contiguous record, calls index repair
  once, replaces that record's index state with `updated`, and only then
  continues at the next proposal. It does not classify or reconcile the
  repaired proposal again.
- A repair failure returns `index_repair_required` again with the same semantic
  checkpoint and new error so a later retry remains explicit.
- Checkpoints revalidate runtime identity kinds, exact staged serialization,
  measured-unit shape, contiguous record indexes, next index, absence of an
  older pending repair, and latest pending-document equality before a child
  call.
- Returned batch, record, semantic, reconciliation, evidence, and retrieval-
  document containers are copied defensively. Opaque error objects remain
  diagnostic references.
- One coordinator instance rejects overlapping process, resume, and repair-
  resume operations.

## Alternatives considered

### Treat the full batch as atomic

Rejected. Canonical commits happen one proposal at a time and cannot be honestly
rolled back through this application boundary. Reporting a single failure would
hide already durable truth.

### Continue after `pending_repair`

Rejected. FTS/tag canon is current, but missing entity/domain metadata can
change later candidate discovery. Repair is therefore a comparison-readiness
barrier, not merely best-effort telemetry.

### Restage and replay the batch after failure

Rejected. Analyzer output can vary and replaying completed proposals can
duplicate or reinforce knowledge. Checkpoints retain the original exact batch
and the next unprocessed index.

### Persist checkpoints in this task

Rejected. Durable queues require storage, ownership, retry timing, privacy, and
recovery decisions. V0 returns bounded in-memory control state and makes the
missing persistence explicit.

### Invoke the coordinator automatically after every chat turn

Rejected. Live surfaces do not yet supply complete verified identity, and no
provider-backed analyzer/classifier call ownership or user-visible failure
policy is decided.

## Consequences

- A007 now has a complete provider-neutral flow from original message/final
  answer to ordered guarded memory commits when callers inject both semantic
  ports.
- The already-streamed answer remains independent. A post-output failure is a
  memory-processing result and never pretends to roll back chat output.
- Checkpoints contain runtime control IDs and commit evidence; they are not
  model context and currently have no persistence or cross-process guarantee.
- The coordinator relies on `RelationGatedMemoryCommit`'s contract that thrown
  failures do not hide a canonical commit; post-canonical index failure is
  returned as `pending_repair`.
- Actual SQLite integration proves a later proposal sees earlier canon and
  entity/domain indexes without a second staging call.
