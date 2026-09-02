# Semantic memory add-on

Status: Partially implemented

## Discovery context

The owner's Context-First Knowledge Architecture defines bounded, semantically
closed model context and separate persistent, canonical, activation, and audit
concerns. The owner clarified that the A008 memory-engine and its implementation
baseline have not been created. Related local repositories and loose Downloads
prototypes are reference material only, not source authority.

## Proposed outcome

Define an A008-owned coding-agent memory contract, then implement the engine in
bounded slices. CLI and GUI call one application service and never read memory
tables directly. The contract must preserve:

- persistent knowledge versus model context;
- current/superseded versus active/dormant;
- discovery over current active plus dormant knowledge;
- context visibility only after relevance, threshold, and hard budget;
- new/restatement/extend/supersede/conflict reconciliation;
- deterministic validation and atomic updates; and
- audit/provenance outside execution context.

## Implemented foundation

A008-0006 defines the orthogonal canonical/activation state model, explicit
reconciliation, active+dormant discovery, threshold-owned reactivation, a
no-decay coding-agent reference policy, exact serialized-payload measurement,
an atomic persistence port and in-memory adapter, separate application queries,
and a materialized bounded projection. It uses no model or network call.

A008-0009 adds a durable project-namespaced SQLite adapter, a deterministic
bounded retrieval planner, and one hybrid exact/entity, lexical, tag, domain,
and optional-vector candidate funnel. Selected projection is read-only and
debug evidence remains outside execution context.

A008-0010 adds the exported provider-neutral application read path. Verified
runtime context, one hybrid read, at most two committed dialogue messages, and
the original user message become a deterministic budgeted envelope for exactly
one existing `ChatSession` transport call. Routing/control fields are stripped,
and ephemeral context is not committed to history.

A008-0011 makes provider reasoning display-only and adds a bounded staging
service whose analyzer receives only original message plus final answer.
Runtime-owned scopes/defaults, exact batch budget, structural limits, and
duplicate rejection yield untrusted proposals without a relation decision or
write. A deterministic actual-SQLite/fake-provider benchmark proves two-turn
reasoning isolation and repeated retrieval.

A008-0012 adds the explicit provider-neutral write-side gate. One staged
proposal produces one bounded indexed search, materialized active+dormant
candidates, an exact-budget semantic classifier envelope with local handles,
validated five-way output, all-candidate revision guarding, canonical
reconciliation, and observable entity/domain index completion or repair. Actual
SQLite tests prove every relation and stale-state rejection.

A008-0013 adds the provider-neutral sequential application join. One staging
call feeds ordered per-proposal commits; explicit stage/commit/index-repair
states and validated checkpoints allow retry or repair-then-resume without
replaying earlier canon. Actual SQLite proves a later proposal sees an earlier
committed/indexed item in the same batch.

A008-0014 adds concrete model-backed analyzer and relation-classifier adapters
over one injected stateless semantic JSON generator and the existing
`ChatTransport`. Exact request budgeting, strict JSON, reasoning exclusion, and
cancellation propagation are implemented; no live surface composes them.

A008-0015 proves the complete deterministic local order over one shared fake
transport and actual SQLite: read/project, streamed answer, analyze, classify,
guarded indexed `extend`, and next-turn reread of revision two. The proof starts
from active canon and explicitly does not auto-activate a brand-new draft.

## Remaining outcome

The add-on is connected to `ChatSession` through an exported application
orchestrator but is not constructed by CLI, ACP, or Agent Canvas. It has no
provider-backed planning/embedding generation, authorized live semantic
composition, live/background coordinator invocation, durable checkpoint/repair
queue, live verified-context intake, server-scale adapter, or privacy/user-
control policy. Those concerns require later charters rather than expansion of
completed tasks.

## Dependencies

- Complete verified identity context supplied to chat/memory orchestration;
  A008-0007 defines the ID/binding contract but does not create a live mapping.
- Decision on production sidecar versus in-process topology and server-scale
  storage; SQLite already covers the single-process local proof.
- Data classification, encryption, retention, export, deletion, and ACL policy.
- Authorized composition of the bounded analyzer/relation-classifier adapters
  with the existing provider owner, plus explicit live/background and index-
  repair ownership.

## Suggested verification

- Invocation closure and opaque-ID tests.
- Dormant recovery and dormant dedupe tests.
- Supersede, scope-isolation, and no-decay-on-scope-miss tests.
- Preserve the implemented bounded-context test from 100 to 100,000 unrelated
  records as future adapters are added.
- Serialized-payload budget and audit-leakage tests.
- Server-adapter persistence/replay and GUI contract tests without a live model.
