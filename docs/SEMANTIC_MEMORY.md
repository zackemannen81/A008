# Semantic Memory v0

Status: Implemented v0 reference core. The accepted target constitution is
[`KNOWLEDGE_MEMORY_MODEL.md`](KNOWLEDGE_MEMORY_MODEL.md) via
[ADR 0018](adr/0018-knowledge-and-memory-model.md). This document describes
the v0 `KnowledgeItem` engine that
[`KNOWLEDGE_MODEL_GAP_ANALYSIS.md`](KNOWLEDGE_MODEL_GAP_ANALYSIS.md) measures.
A008-0021 is closing that gap; do not treat v0 invariants 3–6 as the
destination model.

## Purpose

Semantic Memory v0 gives A008 a project-owned state and projection boundary. A
caller supplies a validated knowledge proposal and explicit relation decision
on the write side. The read side accepts a deterministic bounded retrieval plan
and selects from indexed canonical knowledge. Neither side claims provider-
backed extraction, classification, or embedding generation. The engine owns
deterministic canonical updates, activation, bounded materialization, and audit
separation.

The design derives from the owner-supplied Context-First Knowledge Architecture
(SHA-256
`770A78D02218F73EA867218CF23B88B8A09997F0EAA1CC5062B045179A7337E2`).
That document remains source input. [ADR 0005](adr/0005-semantic-memory-v0-boundary.md)
owns the state boundary. [ADR 0007](adr/0007-sqlite-hybrid-memory-read-path.md)
owns the SQLite hybrid read-path decision.
[ADR 0010](adr/0010-relation-gated-memory-commit.md) owns bounded candidate
comparison, ID-free relation decisions, stale-state guarding, and explicit
post-commit index state.

## V0 invariants

1. Runtime owns knowledge and state; no model output commits itself.
2. Persistent knowledge is not model context.
3. `current`/`superseded` and `active`/`dormant` are separate dimensions.
4. Normal discovery sees current active and dormant records, never superseded
   history.
5. Relevance reinforcement changes score; threshold or `keepAlive` owns
   activation.
6. A scope miss excludes a record from one task and does not decay it.
7. Context includes materialized propositions, not opaque IDs alone.
8. Required semantics fail explicitly when ineligible or over budget.
9. Budget applies to the exact serialized execution projection.
10. Provenance and audit are queryable but are not execution context.
11. Repository transactions either commit the complete valid state and audit
    update or commit neither.
12. V0 makes no provider or network call.
13. The validated `ProjectId` is a hard storage/retrieval namespace; task scope
    can narrow it but never broaden it.
14. Retrieval relevance, projection eligibility, and persistent activation are
    distinct decisions.
15. Candidate retrieval deduplicates by canonical knowledge ID before scoring,
    and selection evidence never enters execution context.
16. A semantic classifier sees materialized meaning and invocation-local
    handles, never durable/runtime IDs or canonical write capabilities.
17. A relation commit validates every materialized candidate revision inside
    the canonical repository transaction.

## Data boundary

`KnowledgeItem` contains four kinds of data:

| Concern | V0 fields |
| --- | --- |
| Identity and semantics | `id`, `proposition`, `kind`, `tags`, `scope` |
| Canonical lifecycle | `canonicalStatus`, `supersededBy`, `revision` |
| Activation lifecycle | `activationStatus`, `relevanceScore`, `activationThreshold`, `keepAlive` |
| Trust and provenance | `authority`, `confidence`, `sourceBacked`, `provenance` |

Superseding a current item creates a replacement, retains the prior item as
dormant historical state, and links it forward with `supersededBy`. The
repository rejects missing successors, active superseded records, duplicate
IDs, illegal numeric ranges, and supersede cycles.

## Application service

Both future CLI and GUI integrations must call the same `SemanticMemory`
service rather than read repository tables or adapter internals.

```ts
await memory.reconcile(proposal, decision);
await memory.discover(task);
await memory.project(task, budget);
await memory.projectSelected(task, budget, rankedCandidateIds);
await memory.getHistory(oldestKnowledgeId);
await memory.getAudit();

await hybridReader.read(request);
await postOutputIntake.stage({ taskId, message, answer, applicabilityScopes });
await relationCommit.commit({ batch, proposalIndex });
await relationCommit.repairIndex(pendingRepair);
await postOutputCoordinator.process({
  taskId,
  message,
  answer,
  applicabilityScopes,
});
```

The surfaces have different meanings:

- `reconcile` atomically applies one explicit relation decision;
- `discover` returns relevant current canon, including dormant candidates;
- `project` may reinforce relevant records and returns only current active
  materialized context that fits the hard budget;
- `projectSelected` re-reads explicit ranked IDs, adds required/keep-alive
  canon, and projects current active records without lifecycle mutation;
- `getHistory` follows an explicit supersede chain; and
- `getAudit` reads control-plane evidence separately; while
- `HybridMemoryReader.read` plans, retrieves, deduplicates, scores, selects,
  and returns the projection plus bounded evidence; while
- `PostOutputKnowledgeIntake.stage` validates a semantic-only analyzer result
  and returns conservative untrusted proposals without writing memory; while
- `RelationGatedMemoryCommit.commit` compares one proposal with bounded current
  candidates, validates an ID-free five-way decision, and calls guarded
  reconciliation; and
- `repairIndex` retries only a previously returned entity/domain document.
- `PostOutputMemoryCoordinator.process` stages once and invokes relation commit
  sequentially with explicit partial-failure and repair checkpoints.

There is intentionally no application-level `getAllKnowledge()` path.

## Reconciliation

| Decision | Deterministic v0 transition |
| --- | --- |
| `new` | Create a new current item using the injected ID factory. |
| `restatement` | Keep the target ID/proposition, merge metadata and provenance, reinforce, then evaluate threshold. |
| `extend` | Keep the target ID, replace its proposition with the caller-approved enriched proposition, merge metadata, reinforce, then evaluate threshold. |
| `supersede` | Mark the current target superseded+dormant and create a linked current replacement. |
| `conflict` | Preserve canonical state and append a conflict audit event for valid current targets. |

These remain execution decisions, not classifier authority. The implemented
relation gate compares against materialized current candidates, including
dormant items, gives its injected classifier local handles only, validates the
returned relation, maps handles to IDs at runtime, and passes one explicit
decision to this service. A concrete model-backed classifier adapter can now
delegate the ID-free envelope through the shared stateless semantic JSON owner;
this service remains provider-neutral. Local CLI/ACP invoke it through
`createLocalMemoryRuntime` after each delivered answer.

## Discovery and reference policy

The included `CodingAgentMemoryPolicy` is intentionally small and deterministic:

- `keepAlive` or explicitly required IDs are relevant;
- otherwise scope must be global or intersect the task scope;
- when task terms are supplied, at least one item tag must match;
- relevant items receive configured reinforcement;
- threshold remains the activation authority; and
- ranking is required/keep-alive first, then authority, relevance, and ID.

It has no decay. A policy can change relevance and ordering, but the engine
re-materializes canonical records by ID after ranking so policy code cannot
rewrite their semantic content.

## Projection and budget

The serialized v0 payload is stable JSON:

```json
{
  "taskId": "task-42",
  "items": [
    {
      "id": "knowledge-17",
      "proposition": "The provider call remains owned by A008.",
      "kind": "architecture-decision",
      "tags": ["provider"],
      "scope": ["runtime"],
      "authority": 1
    }
  ]
}
```

The serializer does not include canonical lifecycle, activation scores,
provenance, selection traces, or audit events. `SerializedContextMeasurer`
measures this exact string. `Utf8ByteContextMeasurer` is the reference adapter;
a future provider/model-specific tokenizer can report exact token units.

Required IDs and all `keepAlive` items are attempted first. If one is missing,
does not become active, or cannot fit, the transaction fails. Optional ranked
items that do not fit are omitted. Reinforcement and audit updates roll back on
any projection failure.

The hybrid path uses `projectSelected` instead. Dormant records can appear in
candidate evidence but cannot cross the projection boundary and are not
reinforced or reactivated. Required and keep-alive canon is attempted first;
the same exact serialized hard budget remains authoritative.

## Hybrid retrieval

`DeterministicRetrievalPlanner` accepts verified project, conversation,
runtime-task, and agent IDs, the current message, applicability scopes, and at
most two bounded recent raw turns. It derives intent, normalized domains, tags,
entities, lexical terms, temporal hints, and at most three semantic queries. It
cannot choose knowledge IDs or mutate memory.

`HybridMemoryReader` requests bounded candidates from exact/entity, SQLite FTS5
lexical, tag, domain, and optional vector channels. It deduplicates by canonical
ID, applies configurable named weights for those channels plus strength and
authority, and enforces candidate and projection thresholds before the exact
projection budget. Missing embedding configuration degrades to the other
channels without a provider call. See [Hybrid Memory Read Path](HYBRID_MEMORY_READ_PATH.md)
for the complete contract and current scale evidence.

## Application read-path composition

`MemoryAwareChatSession` supplies the implemented application boundary above
the reader. It fixes verified project/conversation/agent identity, validates a
runtime task per turn, passes at most two committed raw dialogue messages to
retrieval, and composes the projection plus original message into one bounded
invocation through the existing `ChatSession` transport owner.

`DeterministicMemoryPromptComposer` does not forward the projection's serialized
form. It materializes proposition/kind/tags/scope/authority into a user-level
JSON envelope and strips runtime IDs, knowledge IDs, retrieval evidence,
lifecycle state, provenance, and audit. The synthetic context instruction and
envelope are invocation-only; successful history retains only the original user
message and assistant answer. See [Memory-Aware Chat Orchestration](MEMORY_AWARE_CHAT_ORCHESTRATION.md).

Provider reasoning is separate completion/presentation data. It never becomes a
chat message and is absent from later retrieval history and provider context.

## Post-output proposal staging

`PostOutputKnowledgeIntake` accepts validated runtime context but creates an
analyzer input with exactly the normalized original user message and final
assistant answer. Reasoning, completion metadata, history, identity, memory
projection, and retrieval evidence are not present.

The analyzer can draft proposition, kind, tags, domains, entities, and
confidence. Runtime applies verified scopes and conservative relevance,
threshold, keep-alive, authority, source-backed, and provenance values. Stable
serialization, exact UTF-8 budget, structural limits, duplicate rejection, and
defensive copies make the batch bounded and deterministic.

Staging has no repository or `SemanticMemory` port and performs no relation
decision, canonical write, retrieval-index update, reinforcement, reactivation,
weakening, or decay. See [Post-output knowledge intake](POST_OUTPUT_KNOWLEDGE_INTAKE.md)
and [ADR 0009](adr/0009-reasoning-and-post-output-intake.md).

## Relation-gated proposal commit

`IndexedRelationCandidateSource` creates one bounded project/scope-constrained
exact/entity, lexical, tag, and domain query from a staged proposal. It
deduplicates, deterministically ranks, and materializes current active or
dormant candidates. It performs no provider call or vector generation.

`RelationGatedMemoryCommit` exact-budgets an ID-free classifier envelope,
trimming only the optional candidate tail. The classifier sees semantic fields,
authority/confidence, activation status, and local `candidate_N` handles. It
does not see runtime or knowledge IDs, revisions, scores, reasons, provenance,
audit, history, or reasoning. Only validated known handles become a five-way
`ReconciliationDecision`.

Every materialized candidate revision is checked inside the canonical
transaction. Conflict changes audit only. Other relations return a current item
and attempt one staged entity/domain upsert. Index completion is observable as
`updated`, `not_required`, or `pending_repair`; repair retries the document
without reconciling again. See
[Relation-gated memory commit](RELATION_GATED_MEMORY_COMMIT.md) and
[ADR 0010](adr/0010-relation-gated-memory-commit.md).

## Sequential post-output batch

`PostOutputMemoryCoordinator` connects the two provider-neutral boundaries
without pretending the batch is atomic. It stages once, revalidates the exact
batch, and commits proposals by stable index. Completed records stay ordered.
Stage failure implies zero commit calls; commit failure returns the exact retry
index; and `pending_repair` blocks later comparison until the document is
repaired.

`resume` never restages or repeats earlier completed proposals.
`repairAndResume` performs no second classifier/reconcile for the canonically
committed pending proposal. Checkpoints are defensively copied, validated
runtime control state and never model context. They are not persisted. See
[Post-output memory coordinator](POST_OUTPUT_MEMORY_COORDINATOR.md) and
[ADR 0011](adr/0011-post-output-memory-coordinator.md).

## Persistence and concurrency

`MemoryRepository` separates the application service from storage. Its
transaction callback sees a working copy and commits only after full state
validation. `InMemoryMemoryRepository` serializes concurrent transactions and
returns defensive copies. It is suitable for deterministic tests and local
reference use only; restart loses all state.

`SqliteMemoryRepository` is the durable single-process local adapter. It accepts
an explicit filename and validated `ProjectId`, initializes schema v1, persists
canonical JSON and audit atomically, validates state on open, and maintains
project-scoped FTS5/tag/entity/domain/optional-vector indexes. It survives
reopen and serializes transactions inside one process. Canonical-derived FTS
and tags update inside that transaction. Proposition changes invalidate
entity/domain/vector metadata until the caller explicitly re-indexes it; the
relation gate performs the staged entity/domain upsert and exposes failure as
`pending_repair`.

This local adapter does not claim multi-process/server scale, backup/recovery,
encryption, account ACLs, retention, deletion/export, or production migration
policy. PostgreSQL/Supabase remains a possible later repository adapter behind
the same application boundary.

## Security and egress

The provider-neutral memory logic imports no chat transport, provider adapter,
ACP surface, CLI, environment reader, or network client. The optional SQLite
adapter receives its file path explicitly and reads no environment or
credential. Tests use in-memory and temporary SQLite data only. `.env.local`
and `NVIDIA_API_KEY` are not inputs to this system.

Provenance can contain sensitive identifiers in a future deployment. Its
presence outside context is necessary but not a privacy policy. Data
classification, minimization, retention, deletion, export, encryption, and
authorization remain mandatory decisions before persistent user data is stored.

## Deferred work

- verified runtime-context intake from CLI/ACP/Agent Server/Canvas;
- exact model tokenizer selection and output-headroom accounting;
- provider-backed planning/embedding generation and authorized live composition
  of the implemented analyzer/classifier adapters;
- server-scale persistence, graph retrieval, and privacy/user-control policy;
- automatic/background post-output invocation, durable checkpoint/repair queue,
  retry/idempotency policy, and semantic uniqueness for concurrent `new`
  decisions;
- chat/CLI/ACP/Canvas integration and failure presentation; and
- audit replay, metrics, packaging, and deployment.
