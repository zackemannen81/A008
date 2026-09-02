# Decision Records

Discoverability: index. Every member is listed below.
Member state: required. Every member declares a `Status:` line.

Accepted records keep their path. Superseded decisions remain and link to their
replacement.

## Records

- [`0001-product-composition.md`](0001-product-composition.md) — Accepted;
  a007 combines a shared core, CLI, Agent Canvas-derived GUI, and optional
  add-ons including semantic memory.
- [`0002-license-and-source-boundaries.md`](0002-license-and-source-boundaries.md)
  — Accepted; Apache-2.0 for a007-owned content with preserved third-party
  license/provenance boundaries.
- [`0003-initial-runtime-and-provider-boundary.md`](0003-initial-runtime-and-provider-boundary.md)
  — Accepted; Node.js/TypeScript single package with provider-neutral core and
  NVIDIA behind an injected transport.
- [`0004-agent-canvas-acp-boundary.md`](0004-agent-canvas-acp-boundary.md) —
  Accepted; standalone Agent Canvas reaches the shared a007 chat core through
  Agent Server and a custom stdio ACP bridge.
- [`0005-semantic-memory-v0-boundary.md`](0005-semantic-memory-v0-boundary.md) —
  Accepted; provider-neutral memory service, atomic persistence port, explicit
  reconciliation, and bounded materialized projections without model calls.
- [`0006-runtime-identity-v0.md`](0006-runtime-identity-v0.md) — Accepted;
  versioned typed runtime IDs and an atomic ACP binding port/reference without
  inventing unavailable external conversation mappings.
- [`0007-sqlite-hybrid-memory-read-path.md`](0007-sqlite-hybrid-memory-read-path.md)
  — Accepted; project-namespaced SQLite persistence and one bounded hybrid
  candidate funnel produce a read-only semantic-memory projection.
- [`0008-memory-aware-chat-orchestration.md`](0008-memory-aware-chat-orchestration.md)
  — Accepted; verified runtime context, bounded memory/dialogue, and the
  original message compose one ephemeral request through the existing chat
  provider owner.
- [`0009-reasoning-and-post-output-intake.md`](0009-reasoning-and-post-output-intake.md)
  — Accepted; reasoning is display-only and post-output analysis can stage only
  bounded runtime-scoped semantic proposals without writing memory.
- [`0010-relation-gated-memory-commit.md`](0010-relation-gated-memory-commit.md)
  — Accepted; bounded ID-free candidate comparison, guarded five-way
  reconciliation, and explicit retrieval-index repair form the first safe
  memory write boundary.
- [`0011-post-output-memory-coordinator.md`](0011-post-output-memory-coordinator.md)
  — Accepted; one staging call feeds sequential per-proposal commits with
  explicit partial failure, checkpoint resume, and index-repair barriers.
- [`0012-stateless-semantic-json-model-calls.md`](0012-stateless-semantic-json-model-calls.md)
  — Accepted; analyzer and classifier share one stateless, strict, budgeted
  semantic JSON owner over the existing chat transport without history or
  reasoning retention.
- [`0013-local-memory-surfaces-and-debug-trace.md`](0013-local-memory-surfaces-and-debug-trace.md)
  — Accepted; CLI and a007 ACP share one local memory composition root, a
  narrow user-assertion activation gate, and an opt-in secret-safe debug trace.
- [`0014-live-write-path-reinforcement.md`](0014-live-write-path-reinforcement.md)
  — Accepted; live CLI/ACP apply the engine restatement/extend score boost and
  keep retrieval non-mutating.
- [`0015-reasoning-has-no-path-to-knowledge.md`](0015-reasoning-has-no-path-to-knowledge.md)
  — Accepted; NVIDIA channel leaks are normalized so reasoning cannot enter
  committed content, analyzer input, or canon; semantic calls are non-thinking.
- [`0016-write-path-source-message.md`](0016-write-path-source-message.md)
  — Accepted; user-assertion activation uses staged `sourceMessage`, overlapping
  turns are rejected, and restatement/extend boost remains origin-agnostic.
- [`0017-classifier-relation-type-alias.md`](0017-classifier-relation-type-alias.md)
  — Accepted; classifier JSON may name a canonical five-way relation as `type`
  or `relation`; unknown names still fail closed.
