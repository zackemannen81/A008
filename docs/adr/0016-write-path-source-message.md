# ADR 0016 — Explicit write-path source message

Status: Accepted

Date: 2026-09-01

Decision owner: mrWhite81 and felixnissen

## Context

User-assertion activation stored the original user text in a mutable field on
`UserAssertionMemoryPort`. `LocalMemorySession.turn` set that field before
chat, then post-output called `reconcile` later. The memory-aware chat lock
does not cover post-output, so a second turn could overwrite the field before
the first turn committed. HTTP traces also lacked `operation`, and
`CURRENT_STATUS` still described the write path as disconnected.

## Decision

- `StagedKnowledgeBatch.sourceMessage` is the original user text. It is runtime
  control state, not model context.
- `RelationGatedMemoryCommit` may inject `activateNewProposal(sourceMessage,
  proposal)` and applies it only for validated `new` decisions.
- `LocalMemorySession` rejects a second turn until chat and post-output settle.
- HTTP request/response traces include `operation` plus `httpCallId`.
- `turn_complete` records `chatStatus` and `memoryStatus`. Overall `degraded`
  means chat succeeded and memory did not.
- Validated `restatement`/`extend` still add `+0.2` regardless of whether the
  supporting text came from the user message or the assistant answer. Restricting
  boosts to user-backed evidence is a later policy.
- Live hybrid read has no embedding provider and an empty planner taxonomy.
  Vector RAG and tag/domain read channels remain optional adapters.

## Alternatives considered

### Mutex only around `setCurrentMessage`

Rejected. Ambient mutable state is the defect. The message belongs on the
staged batch.

### Boost only user-backed restatement/extend now

Deferred. That needs an evidence-kind on the relation decision. Current
confirmed-use is “the relation gate accepted restatement or extend”.

## Consequences

- A rejected overlapping turn cannot change another turn's activation.
- Current truth must describe live write-path invocation, empty live taxonomy,
  and non-configured RAG.
