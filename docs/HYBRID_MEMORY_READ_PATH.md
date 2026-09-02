# Hybrid Memory Read Path

Status: Implemented provider-neutral local read path, consumed by the exported
memory-aware chat orchestrator. Not wired to CLI, ACP, Canvas, or a live
embedding provider.

## Purpose

The read path turns one verified application request into one minimum-sufficient
memory projection. Persistent knowledge, retrieval candidates, execution
context, and debug evidence remain separate.

```text
verified project/conversation/task/agent identity
  + current message
  + at most two bounded recent raw turns
                    |
                    v
        DeterministicRetrievalPlanner
                    |
                    v
 project namespace + applicability scope filter
                    |
                    v
 exact/entity --.
 lexical/FTS5 ---+--> deduplicate by canonical ID
 tag ------------+    -> weighted score
 domain ---------+    -> candidate threshold
 optional vector-´    -> projection threshold
                         -> active-only item limit
                    |
                    v
     SemanticMemory.projectSelected
       -> canonical re-read
       -> required/keep-alive first
       -> exact serialized hard budget
                    |
                    v
          one ContextProjection

separate result -> bounded selection/score evidence
```

## Verified identity envelope

`MemoryReadRequest` requires branded `ProjectId`, `ConversationId`,
`RuntimeTaskId`, and `AgentId`. The deterministic planner parses all four again
at runtime. `SqliteMemoryRepository` is constructed for exactly one parsed
project ID and rejects a retrieval plan for another project.

Project identity is the hard storage namespace. `applicabilityScopes` are
semantic filters inside that namespace. A classifier can narrow applicability;
it cannot request data from another project.

The exported `MemoryAwareChatSession` supplies this complete envelope when its
application caller already has verified identities. The current ACP bridge
cannot supply them, so no live ACP/CLI/Canvas path invokes memory.

## Retrieval planner

The baseline planner is deliberately deterministic and provider-free. It:

- retains the original message as `queryText`;
- classifies bounded `question`, `instruction`, `correction`, `continuation`,
  and `statement` signals;
- matches only constructor-supplied domain/tag taxonomy values;
- extracts bounded quoted/backticked entities and conservative capitalized
  sentence entities;
- emits at most 16 normalized terms and eight entities by default;
- derives current/past/future hints; and
- creates at most three semantic-query strings from the current message and the
  last user/assistant turns, each recent turn truncated to 1,000 characters.

It emits no selected knowledge IDs. A future provider-backed planner must
implement the same interface, preserve the verified identities, validate its
structured output, and remain read-only.

## SQLite storage and index

`SqliteMemoryRepository` uses schema version 1 and an injected path. A file can
hold several project namespaces without sharing records between their views.

The canonical table stores the complete validated JSON record plus indexed
canonical/activation/revision columns. Audit events remain separate. Derived
retrieval surfaces include:

- FTS5 over current proposition, kind, tags, and scopes;
- indexed normalized canonical tags;
- explicitly indexed entities and domains; and
- optional model-named finite non-zero embedding vectors.

Changing a canonical proposition invalidates its explicit entity/domain/vector
metadata. Current FTS and canonical tags are rebuilt atomically from canonical
state. Embeddings must be regenerated explicitly; this task contains no hidden
provider call.

File-backed SQLite uses foreign keys and WAL. Local repository operations are
serialized; canonical state and audit commit or roll back together. The adapter
validates all stored state on open and rejects an unsupported schema version.

## One candidate funnel

The candidate store applies project namespace and applicability scope before
each bounded channel limit. Channel scores are merged per canonical knowledge
ID. The neutral policy's default weights are:

| Component | Weight |
| --- | ---: |
| exact/entity | 0.25 |
| lexical | 0.20 |
| semantic | 0.20 |
| tag | 0.10 |
| domain | 0.10 |
| authority | 0.10 |
| existing strength | 0.05 |

Defaults are experimental configuration, not tuned universal truth. They sum to
one and can be replaced as one validated policy. Candidate and projection
thresholds default to 0.10 and 0.25. The persistent activation threshold remains
owned by each canonical item and is not replaced by either value.

Semantic retrieval is optional. `EmbeddingProvider` receives at most three
queries and must return one equal-purpose vector per query. When no provider is
configured, exact/lexical/tag/domain channels continue without network access.
Stored equal-model/equal-dimension vectors are compared by cosine similarity in
process. A future PostgreSQL/pgvector adapter can replace this local scan without
changing the planner, reader, or projection contract.

## Projection boundary

`HybridMemoryReader` admits bounded candidates, filters by projection threshold
and active status, and passes only ranked IDs to
`SemanticMemory.projectSelected`. The service then re-reads canonical content;
retrieval metadata cannot rewrite propositions.

`projectSelected` is deliberately read-only. It does not call the legacy
projection-reinforcement policy, append an audit event, or update revision,
strength, or activation. Dormant current records can be found and reported but
cannot enter the projection. Required and keep-alive current records remain hard
requirements and fail if missing, dormant, or too large.

The stable serialized projection still contains only task ID and materialized
semantic items. Candidate scores, activation data, raw query plans, provenance,
and evidence are excluded. The exact configured measurement applies to the
complete serialized string.

## Evidence result

Each read returns bounded control-plane evidence containing:

- persistent current-record count;
- hit count per channel and unique/admitted candidate counts;
- bounded candidate score components, channels, and reasons;
- candidate, projection, and per-item activation thresholds;
- dormant candidates and explicit exclusion reasons;
- selected and omitted IDs; and
- final projection size and measurement unit.

The evidence is diagnostic data. The implemented prompt composer accepts
`ProjectionResult`, never `MemoryReadEvidence`, `RetrievalPlan`, the SQLite
repository, or a general knowledge listing. It further strips task and
knowledge IDs from provider-visible context.

## Security and lifecycle limits

The implementation reads no environment variable and includes no embedding or
chat provider. Automated tests use only temporary or in-memory SQLite databases.
No Supabase service, Docker stack, external database, `.env.local`, or user data
participates.

SQLite persistence is not yet authorized for real user memory. Before that,
a bounded task must define account authorization, encryption, retention,
deletion/export, backup/recovery, corruption handling, and user controls.

Retrieval is not use. This read path never reinforces, reactivates, weakens, or
decays records. The separate relation-gated write path reuses
`MemoryCandidateStore` for bounded semantic comparison, including dormant
current records, then calls guarded reconciliation explicitly. It does not turn
read-path selection into implicit reinforcement or activation.

## Deferred work

- provider-backed structured planning and embedding generation;
- relation/graph candidate expansion;
- confirmed-use reinforcement/reactivation and domain lifecycle policies;
- authorized live composition of the implemented post-output analyzer/relation-
  classifier adapters plus automatic invocation of the five-way commit
  boundary;
- complete identity binding from CLI/ACP/Agent Server into this read request;
- user-visible failure/degraded-mode behavior;
- exact model-token measurement and output-headroom accounting;
- privacy/user control and production persistence policy; and
- PostgreSQL/pgvector or another server/multi-process adapter when justified.
