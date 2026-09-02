# ADR 0005 — Semantic-memory v0 boundary

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

The owner supplied a Context-First Knowledge Architecture that separates
persistent canonical state, activation, discovery, bounded model context, and
audit. No a007 memory implementation or adopted baseline existed. The shared
CLI/Canvas chat path already has one provider-call owner, so a first memory
slice must prove state and projection semantics without introducing another
model invocation or binding memory directly to a UI or provider.

The source document is design input with SHA-256
`770A78D02218F73EA867218CF23B88B8A09997F0EAA1CC5062B045179A7337E2`.
Its wording is not repository authority. This decision adopts only the bounded
rules stated below.

## Decision

- The first memory capability is an exported, provider-neutral TypeScript
  application service named `SemanticMemory` inside the existing package.
- Canonical status (`current` or `superseded`) and activation status (`active`
  or `dormant`) are separate fields. Superseded records are retained as dormant
  history and never enter normal discovery or context selection.
- Persistence is accessed through `MemoryRepository`. The first adapter is an
  atomic, transaction-serialized in-memory reference implementation; durable
  storage remains replaceable and unselected.
- Reconciliation accepts an explicit caller decision: `new`, `restatement`,
  `extend`, `supersede`, or `conflict`. The v0 engine validates and applies that
  decision but does not classify semantics or call a model.
- Discovery searches current active and dormant records. Context projection
  reinforces only relevant records, then threshold or `keepAlive` determines
  activation. A scope miss does not change score or activation.
- `keepAlive` and explicitly required current records are hard-required. If
  they are not eligible or do not fit, projection fails atomically instead of
  omitting them.
- Policy may decide relevance, reinforcement values, and rank order. It cannot
  replace canonical record contents. The coding-agent reference policy uses
  exact scope/tag intersection, deterministic authority/relevance/ID ordering,
  and no decay.
- Context contains materialized semantic fields, not bare IDs. A stable JSON
  serializer creates the exact execution payload. An injected measurer enforces
  a hard limit over that exact string. The reference measurer counts UTF-8
  bytes; an exact model-token measurer may be supplied later.
- Audit events and provenance remain separate from the serialized projection.
  Discovery, projection, history, and audit are distinct service surfaces; no
  general `getAllKnowledge()` application API is introduced.
- No chat, CLI, ACP, Canvas, provider, or environment integration is part of
  v0. Existing provider ownership remains unchanged.

## Alternatives considered

### Start with generic RAG or a vector database

Rejected. Retrieval infrastructure does not define canonical truth,
supersession, activation, required-context failure, or atomic state semantics.

### Let the engine infer reconciliation with the current chat model

Rejected. It would create a hidden provider call, make deterministic state
tests depend on model behavior, and reopen the accepted provider boundary.

### Couple memory directly to `ChatSession` or ACP

Deferred. Automatic ingestion and projection require identity, privacy,
post-output analysis, failure, and user-control decisions that are not yet made.

### Choose a durable database first

Deferred. The repository port and transaction semantics can be proven before
selecting migrations, encryption, retention, synchronization, or topology.

### Use character count as an implicit token estimate

Rejected. The hard limit applies to an explicitly named measurement of the
exact serialized payload. V0 provides exact UTF-8 bytes and leaves exact model
tokens to a future injected adapter.

## Consequences

- a007 now has its own testable memory contract and reference engine without a
  live model, credential, network, database, or UI dependency.
- Dormant records remain available to a caller's reconciliation/discovery
  workflow while only activated relevant records can cross the context boundary.
- Callers remain responsible for extraction and semantic relation decisions.
- The in-memory adapter is a reference and test implementation, not production
  persistence or a claim that semantic retrieval is complete.
- A later task must define durable identities, privacy/lifecycle controls,
  tokenizer/model coupling, semantic discovery/classification, persistence, and
  the explicit chat/ACP integration sequence.
