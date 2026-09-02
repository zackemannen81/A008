# Post-output memory coordinator

Status: Implemented provider-neutral sequential coordinator. Concrete analyzer
and classifier adapters exist over an injected shared chat transport, but no
live provider composition, background queue, CLI, ACP, Agent Server, Canvas, or
GUI invokes this coordinator.

## Purpose

`PostOutputMemoryCoordinator` joins the implemented reasoning-free staging and
one-proposal relation-commit services while preserving their separate failure
boundaries. It answers three application questions explicitly:

- did semantic staging fail before any write attempt;
- which proposals are already durably processed; and
- what exact operation must happen next without replaying earlier work?

The coordinator owns ordering and result shape. It does not own semantic model
calls, canonical transitions, retrieval storage, or background execution.

## Fresh processing

```text
taskId + original message + final answer + verified scopes
                         |
                         v
        exact copied staging input (one call)
                         |
                .--------+---------.
                |                  |
         staging_failed      validated batch
                                   |
                                   v
                      proposal 0, 1, ... sequentially
                                   |
                   .---------------+----------------.
                   |               |                |
              completed       commit_failed   pending_repair
                                      |                |
                                resume same       repair index,
                                proposal          then continue
```

Only `taskId`, normalized `message`, normalized `answer`, and a copied
`applicabilityScopes` array cross into the stager. Extra runtime properties on a
JavaScript caller object are ignored. In particular, reasoning and full
completion/control objects are not part of this input type or allocation.

Staging runs once for a fresh attempt. A zero-proposal batch completes with no
relation call.

## Result states

### `completed`

The original validated staged batch and one ordered record for every proposal
are returned. Each record contains the existing `RelationGatedCommitResult`, so
relation, reconciliation evidence, canonical result, and final index state stay
observable.

### `staging_failed`

The stager threw or returned a malformed batch. No proposal commit was called.
The previously delivered chat answer, if any, remains independently complete.

### `commit_failed`

The relation committer threw for `failedProposalIndex`. Earlier records are
already complete. The returned checkpoint uses that same index as
`nextProposalIndex`; `resume(checkpoint)` retries it, then continues in order.
It never calls staging or repeats earlier records.

This relies on the concrete `RelationGatedMemoryCommit` contract: validation,
budget, classifier, stale-state, and canonical-transaction failures throw
without a hidden commit, while a failure after canonical commit is returned as
`pending_repair` instead.

### `index_repair_required`

The most recent proposal committed canonical truth but its entity/domain
retrieval document failed to upsert. Later proposals are not attempted because
their candidate comparison might depend on that metadata.

`repairAndResume(checkpoint)`:

1. verifies the pending document matches the latest contiguous commit record;
2. calls `repairIndex` once;
3. changes only that record's index result to `updated`; and
4. continues from the next proposal without staging, classifying, or
   reconciling the repaired proposal again.

If repair fails, the same status and semantic checkpoint return with the newest
error. Retry count and timing belong to a later queue/worker policy.

## Checkpoint contract

A commit checkpoint contains:

```ts
interface PostOutputMemoryCommitCheckpoint {
  batch: StagedKnowledgeBatch;
  nextProposalIndex: number;
  records: readonly PostOutputMemoryCommitRecord[];
}
```

An index checkpoint adds the pending proposal index and
`PendingRelationIndexRepair`. Before any child call, runtime validates:

- project, conversation, task, and agent ID kinds;
- exact staged proposal serialization and measurement metadata shape;
- next-index range;
- contiguous record indexes starting at zero;
- no older unresolved pending index result; and
- equality between the latest record's pending document and the repair
  document.

The current checkpoint is process-level control state, not a durable or
unforgeable capability. A future persistence task must define schema, integrity,
ownership, idempotency, privacy, and migration. Checkpoints never enter analyzer
or relation-classifier context.

## Concurrency and copies

One coordinator instance allows one process, resume, or repair-resume operation
at a time. Overlap fails before a second child call.

`process`, `resume`, and `repairAndResume` accept an optional
`SemanticOperationContext`. Its `AbortSignal` reaches analysis and every later
relation-classifier transport request. Analysis cancellation is reported as
`staging_failed`; classification cancellation is `commit_failed` at the same
proposal checkpoint. Repair itself is an existing index operation rather than
a semantic call; the signal applies to later proposal processing after repair.

The coordinator copies staging input, batch/proposal arrays, record arrays,
classifier and reconciliation decisions, knowledge item arrays, evidence arrays,
and retrieval documents. Caller mutations cannot rewrite the stager's batch or
the coordinator's prior containers. Opaque errors remain diagnostic references
and are not serialized into semantic context.

## Actual SQLite evidence

The integration test stages two different proposals once. Proposal zero is
classified `new`, creates dormant canon, and updates entity/domain metadata.
Proposal one then discovers that earlier item through the real SQLite candidate
store and classifies it as `extend`. The final repository has one current
revision-two item plus ordered create/extend audit events and remains retrievable
through exact/entity, lexical, tag, and domain channels.

No test loads `.env.local`, calls a live provider, starts OpenHands, Docker, or
Supabase, or uses an external database.

The [committed memory-loop benchmark](MEMORY_LOOP_BENCHMARK.md) adds a complete
local read/chat/commit/reread proof. It extends one already-active item and does
not alter the conservative dormant default for brand-new proposals.

See [Post-output knowledge intake](POST_OUTPUT_KNOWLEDGE_INTAKE.md),
[Relation-gated memory commit](RELATION_GATED_MEMORY_COMMIT.md), and
[ADR 0011](adr/0011-post-output-memory-coordinator.md). Concrete semantic call
ownership is in
[Stateless semantic JSON model calls](SEMANTIC_JSON_MODEL_CALLS.md).
