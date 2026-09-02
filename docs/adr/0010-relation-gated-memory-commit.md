# ADR 0010 — Relation-gated memory commit

Status: Accepted (amended by ADR 0018)

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

`PostOutputKnowledgeIntake` can stage bounded semantic proposals, and
`SemanticMemory` can execute an explicit five-way reconciliation decision. The
missing boundary was the comparison between those two services. A model must
see enough current meaning to distinguish new knowledge from a restatement,
extension, replacement, or conflict, but it must not receive durable IDs or be
allowed to write canonical state directly.

Candidate lookup and classification also create a concurrency window. A target
can change after it is materialized but before reconciliation begins. Finally,
canonical SQLite state and its FTS/tag indexes are transactional, while staged
entity/domain metadata is maintained through a separate retrieval-index port.
Treating both writes as one invisible success would make partial state
ambiguous.

## Decision

- `RelationGatedMemoryCommit` processes exactly one proposal from a validated
  `StagedKnowledgeBatch` per call.
- It revalidates runtime identity kinds, project namespace, proposal index,
  conservative staged fields, and the exact stable batch serialization before
  candidate lookup.
- `IndexedRelationCandidateSource` creates one project- and scope-constrained
  provider-free exact/entity, lexical, tag, and domain query. It makes no
  embedding call, deduplicates hits by knowledge ID, sums the best score per
  channel, orders by descending score then ID, applies a hard limit, and
  materializes current active or dormant records through `SemanticMemory`.
- The classifier receives the staged semantic proposal and bounded materialized
  candidate proposition, kind, tags, scope, authority, confidence, and
  activation status. Candidates have invocation-local handles such as
  `candidate_1`.
- The classifier does not receive project/runtime/knowledge IDs, revisions,
  scores, retrieval reasons, provenance, audit, repository state, message
  history, provider reasoning, or completion metadata.
- The exact classifier JSON envelope is measured. Optional candidates are
  removed from its deterministic tail until it fits. A proposal-only envelope
  that does not fit fails before the classifier is called.
- Classifier output is untrusted. Runtime accepts only `new`; one known local
  handle for `restatement`, `extend`, or `supersede`; or one or more unique
  known local handles for `conflict`. Runtime alone maps handles to durable IDs.
- All materialized current candidate IDs and revisions form a
  `ReconciliationGuard`. `SemanticMemory.reconcile` validates that guard inside
  its existing repository transaction before any transition or audit write.
  A changed, missing, or no-longer-current candidate fails with `stale_state`.
- `SemanticMemory` remains the sole canonical transition authority and retains
  the five existing relation semantics.
- The SQLite transaction already maintains canonical-derived FTS and tag
  indexes. After a non-conflict commit, the coordinator makes one explicit
  entity/domain document upsert for the returned current item.
- Index state is part of the result: `updated`, `not_required` for conflict, or
  `pending_repair` when canonical truth committed but entity/domain metadata did
  not. `repairIndex` retries only the bounded document and never reconciles a
  second time.
- One service instance rejects overlapping commit or repair operations.

## Alternatives considered

### Give the classifier knowledge IDs

Rejected. Durable IDs are control-plane capabilities, not semantic context.
Local handles let the classifier express a relation without granting it the
ability to invent or retain a storage target.

### Compare only opaque retrieval hits

Rejected. Relation classification requires materialized propositions and
metadata. IDs and scores alone cannot distinguish semantic relations.

### Re-read only the selected target before reconciliation

Rejected. The classification was made against a set of current meanings. The
guard therefore covers every materialized candidate, including candidates
trimmed from the classifier envelope, and is checked atomically with the write.

### Roll back canonical state when entity/domain indexing fails

Rejected. The index port is outside the canonical repository transaction, so a
claimed rollback would be false. Returning committed truth plus an explicit
retry document makes the partial state observable and repairable.

### Automatically commit an entire staged batch

Rejected. Per-proposal processing keeps relation, failure, and index status
unambiguous. Batch policy and cross-proposal atomicity require a later decision.

## Consequences

- A008 now has a provider-neutral write-side orchestration boundary, but no
  provider-backed analyzer or relation-classifier adapter and no automatic
  invocation from chat, CLI, ACP, Agent Server, or Canvas.
- Dormant current knowledge participates in duplicate/conflict comparison even
  though it remains excluded from execution projection.
- `new` still has a documented semantic-duplicate race because v0 has no
  database-level semantic uniqueness key.
- Entity/domain repair is explicit caller-owned work; there is no background
  queue or retry scheduler yet.
- Actual in-memory SQLite integration tests prove all five relations, dormant
  comparison, stale revision rejection, audit/canonical state, and subsequent
  exact, lexical, tag, and domain retrieval.

## Amendment

Amended 2026-09-02 by
[ADR 0018](0018-knowledge-and-memory-model.md). The ID-free classifier
envelope, revision guards, sequential commit, and explicit index-repair
barrier survive as v0 write-path machinery. Withdrawn: the five-way relation
set (`new|restatement|extend|supersede|conflict`) as canonical truth
versioning; discarding conflict proposals. `INTERPRET` proposes; `RECONCILE`
is a deterministic slot state machine whose outcomes are
`re_assertion|change|correction|conflict|retraction|no_op`. `supersede` is
not an outcome. `SemanticMemory.reconcile` remains the v0 compatibility owner
until M4 cutover.
