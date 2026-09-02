# ADR 0009 — Reasoning and staged post-output knowledge intake

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

The provider can return a reasoning stream in addition to the final assistant
answer. A008 already represents these as separate `ChatDelta` and
`ChatCompletion` fields, but the exclusion from history, retrieval, and future
knowledge analysis was implicit. Replaying a verbose reasoning transcript would
undo bounded-context work and would treat speculative intermediate text as if
it were an answer or verified evidence.

A008 also needs the first post-output boundary before relation classification
and canonical reconciliation can be added. That boundary must not allow raw
provider output to write memory or silently create a second provider owner.

## Decision

- Provider output has separate channels:
  - reasoning is ephemeral presentation data;
  - `completion.message.content` is the final assistant answer and the only
    assistant text committed to `ChatSession`; and
  - finish reason and usage are operational metadata.
- Reasoning may be streamed to CLI stderr or emitted as ACP thought events and
  may be returned to the immediate caller as `ChatCompletion.reasoning`. A008
  does not convert it to `ChatMessage`, history, retrieval input, subsequent
  provider context, or knowledge-analysis input.
- External ACP hosts may render or retain their own event logs. Those logs are
  outside A008 chat/memory state and must never be rebound as memory input
  without a later explicit decision.
- `PostOutputKnowledgeIntake` is the first provider-neutral post-output service.
  Its analyzer receives a newly allocated object with exactly two properties:
  normalized original user `message` and final assistant `answer`.
- The analyzer receives no completion object, reasoning, usage, finish reason,
  committed history, memory projection/evidence, or runtime/control identity.
- Analyzer output can propose proposition, kind, tags, domains, entities, and
  confidence. Unknown fields are ignored by explicit materialization.
- Verified runtime context stays outside the analyzer boundary and is attached
  to the staged batch. Caller-verified applicability scopes are normalized and
  applied to every proposal; the analyzer cannot widen them.
- Runtime assigns conservative proposal fields: relevance zero, positive
  configured activation threshold, `keepAlive: false`, configured authority,
  `sourceBacked: false`, and empty provenance. A staged proposal is untrusted
  and dormant if a later explicit caller reconciles it unchanged.
- Proposal count, label counts, and the exact stable serialized proposal batch
  have hard limits. The current reference measurer reports UTF-8 bytes.
- Duplicate semantic propositions and malformed or over-budget analyzer output
  fail closed.
- Staging imports no repository, `SemanticMemory`, provider adapter,
  environment reader, or network client. It cannot reconcile, persist, index,
  reinforce, reactivate, weaken, or decay knowledge.
- A deterministic local benchmark uses an actual in-memory SQLite repository,
  the hybrid reader, a fake streaming transport, and two memory-aware turns.
  It proves channel and context structure, not model quality or performance.

## Alternatives considered

### Analyze the complete `ChatCompletion`

Rejected. That exposes reasoning and operational metadata to an analyzer by
default and makes future accidental retention likely. The narrow semantic input
type makes the intended information boundary explicit.

### Store reasoning in conversation history but exclude it during retrieval

Rejected. It increases persistent transcript size, creates another sensitive
data class, and leaves multiple future replay paths that must remember to filter
it. A008 has no product requirement for durable reasoning transcripts.

### Let the analyzer emit complete `KnowledgeProposal` records

Rejected. Scope, authority, activation, source-backed status, provenance, and
lifecycle are runtime policy. A model-controlled analyzer cannot assign itself
authority or broaden applicability.

### Automatically reconcile every staged proposal as `new`

Rejected. Extraction and semantic relation are different decisions. Automatic
creation would duplicate restatements, miss contradictions, and allow provider
text to become canonical state without comparison.

### Use a live provider in the benchmark

Rejected. Live inference adds credential, cost, nondeterminism, and privacy
concerns. The current proof targets channel isolation and bounded request shape.

## Consequences

- The current CLI screenshot behavior is intentional: reasoning is visible but
  does not become conversation state.
- A later analyzer adapter has a stable minimal contract and a separate budget,
  but no provider-backed analyzer exists yet.
- The next write-side task can compare staged semantic drafts with materialized
  current candidates and emit explicit validated relation decisions before
  calling `SemanticMemory.reconcile`.
- The benchmark can detect regressions where reasoning or control IDs enter a
  later request, while its observed timings remain non-guaranteed evidence.
- A008 still does not automatically learn from a chat response.
