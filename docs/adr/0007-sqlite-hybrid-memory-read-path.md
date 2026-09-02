# ADR 0007 — SQLite hybrid-memory read path

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

Semantic Memory v0 owns deterministic canonical state and exact-budget
projection, while Runtime Identity v0 supplies typed project, conversation,
runtime-task, and agent handles. Neither contract previously selected durable
storage or implemented semantic candidate retrieval.

The owner confirmed the intended closed loop and supplied working narrative
evidence for strength, decay, dormant recall, embedding retrieval, a recent
summary window, and post-output analysis. That source is domain-specific and is
not imported. The adopted general direction is one retrieval funnel rather than
several memory blocks added to the same prompt.

The first persistence choice was SQLite or PostgreSQL through a local self-hosted
Supabase stack. The proof must remain local, provider-neutral, deterministic,
and usable by one CLI/ACP application process before server topology, RLS, or
production privacy behavior is selected.

## Decision

- The first durable memory adapter is SQLite. `SqliteMemoryRepository` accepts
  an explicitly injected filename and validated a007 `ProjectId`; it reads no
  environment configuration.
- One SQLite file may contain multiple project namespaces. Every canonical,
  audit, retrieval-document, tag, entity, domain, and FTS operation includes the
  validated project namespace. Applicability scopes can reduce candidates but
  can never broaden that namespace.
- The adapter implements the existing atomic `MemoryRepository` contract,
  persists complete JSON records plus indexed routing columns, validates schema
  version 1 and canonical state on open, serializes local transactions, and
  rolls back knowledge plus audit together.
- SQLite FTS5 supplies bounded lexical candidates. Indexed exact entities,
  canonical tags, indexed domains, and optional precomputed embeddings supply
  the other channels. Embedding generation is an injected port and no provider
  implementation is selected.
- Stored vectors are compared in process by cosine similarity. This is an
  experimental local-scale adapter, not a server-scale vector-index claim.
- `DeterministicRetrievalPlanner` derives bounded intent, taxonomy matches,
  quoted entities, terms, temporal hints, and at most three semantic queries
  from the current message plus at most two bounded raw recent turns. It cannot
  choose canonical knowledge IDs or mutate state.
- All channel hits deduplicate by canonical ID and pass through one weighted
  ranking policy. Exact/entity, lexical, tag, domain, semantic similarity,
  existing strength, and authority remain named score components.
- Candidate admission threshold, projection threshold, per-record persistent
  activation threshold, maximum projection items, and exact serialized budget
  are separate controls.
- Hybrid retrieval and selected projection are read-only. A retrieved dormant
  current item appears in evidence but cannot enter execution context and is not
  reinforced or reactivated. Confirmed-use lifecycle requires a later decision.
- `SemanticMemory.projectSelected` re-reads explicit ranked IDs from canonical
  storage, excludes dormant and superseded records, puts hard-required and
  keep-alive records first, and materializes one stable projection. It never
  accepts caller-supplied proposition text.
- Candidate counts, component scores, reasons, thresholds, dormant discoveries,
  selected IDs, and projection measurement form a separate bounded evidence
  result. They are not serialized into execution context.
- No chat, CLI, ACP, Canvas, post-output write, relation classification, decay,
  provider, or Supabase integration is part of this decision.

## Dependency decision

The repository continues to support Node.js `>=22.12`. At that floor,
`node:sqlite` is experimental and requires `--experimental-sqlite`. The adapter
therefore pins `better-sqlite3` 13.0.3, whose declared engine is Node.js `>=22`
and whose package license is MIT. Its TypeScript declarations are a pinned
development dependency.

## Alternatives considered

### PostgreSQL/pgvector through local Supabase

Deferred. It is a credible later server adapter, especially for multi-process
access, RLS, and indexed vector scale, but it would make this first contract
proof depend on Docker services, networking, credentials, and operational
topology that the application does not yet require.

### Built-in `node:sqlite`

Rejected for this slice. The declared Node.js floor would require an
experimental runtime flag, so normal package execution would not satisfy the
adapter contract across the supported range.

### Vector similarity as final relevance

Rejected. A vector hit is one candidate signal. It cannot set canonical truth,
activation, required status, or model visibility by itself.

### Reinforce every retrieved record

Rejected. Retrieval means that a record was found, not that it was used or
confirmed. Persistent lifecycle remains a separate operation.

### Copy the narrative implementation and defaults

Rejected. Chapter-based decay, severity values, coping rules, and story scopes
are useful domain evidence but are not neutral core policy.

## Consequences

- A007 now has durable local canonical memory, audit, FTS metadata, and optional
  vector metadata behind the existing repository boundary.
- The read path can scale model-visible context independently of total stored
  knowledge and produces one projection rather than additive memory sections.
- Project namespace isolation is implemented, but account authorization and
  complete ACP/conversation binding are not.
- SQLite files may contain sensitive data. Tests use only temporary fixtures;
  real user-data storage remains prohibited until retention, deletion/export,
  encryption, backup/recovery, and authorization are decided.
- In-process vector comparison and transaction snapshot validation are bounded
  proof implementations. Server-scale storage and multi-process coordination
  remain future adapters rather than hidden promises of this one.
