# ADR 0018 — Knowledge and memory model

Status: Accepted

Date: 2026-09-02

Decision owner: Grok (A008 operator / boss)

Amends: [ADR 0005](0005-semantic-memory-v0-boundary.md),
[ADR 0007](0007-sqlite-hybrid-memory-read-path.md),
[ADR 0010](0010-relation-gated-memory-commit.md),
[ADR 0014](0014-live-write-path-reinforcement.md)

Does not supersede those records wholesale. Their surviving runtime
boundaries remain in force; the contradictions named below are withdrawn.

## Context

A008's v0 memory engine is a careful machine operating on the wrong record.
`KnowledgeItem` conflates identity, truth, time, and salience. The resulting
violations are enumerated in
[`KNOWLEDGE_MODEL_GAP_ANALYSIS.md`](../KNOWLEDGE_MODEL_GAP_ANALYSIS.md)
(V1–V15). The target constitution is
[`KNOWLEDGE_MEMORY_MODEL.md`](../KNOWLEDGE_MEMORY_MODEL.md).

That model was Proposed and had no implementation authority. Closing the gap
to 100% requires accepting it, locking the open sequencing questions, and
forbidding the shortcuts the gap analysis warns against.

## Decision

### D1. The model is constitution

[`KNOWLEDGE_MEMORY_MODEL.md`](../KNOWLEDGE_MEMORY_MODEL.md) is accepted A008
authority for what knowledge is, what exists, what is versioned, what truth
is, what memory is, and what each named process may and may not write. Laws
L1–L12 and inequalities in model §1.2 are not negotiable in child tasks.

Acceptance scenarios S1–S10 in model §11 are the definition of done for the
model. Each `MUST NOT` is as binding as its `MUST`.

Storage (model §12) remains deferred until those scenarios pass against an
in-memory reference.

### D2. Dual path; do not grow `KnowledgeItem`

The v0 `SemanticMemory` / `KnowledgeItem` path remains until cutover after
M6 gates. New model types and processes land in a new tree:

```text
src/memory/knowledge/
test/knowledge-model/
```

Do not add clocks, slots, claim status, or lifecycle fields to `KnowledgeItem`
to paper over V1–V4. Every field added to that record makes the M4 split
harder.

### D3. Clocks live on the new record types

Standalone gap-analysis phase M2 (additive time fields on `KnowledgeItem`) is
rejected. `eventTime`, `validInterval`, `assertedAt`, and `ingestedAt` are
introduced on the new ontology in M3–M5. `unknown` is a representable value
and is never defaulted to now. `ingestedAt` is never a proxy for world time.

### D4. Split INTERPRET from RECONCILE

- `INTERPRET` resolves entities and slots and proposes claims, events, and
  bindings. It writes nothing. A model-backed analyzer may produce INTERPRET
  proposals. The v0 five-way classifier is a semantic comparator at most; it
  does not own truth versioning.
- `RECONCILE` is a deterministic slot state machine. Outcomes are exactly
  `re_assertion | change | correction | conflict | retraction | no_op`.
  `supersede` is not an outcome. A new value is a `change`.
- `ACCEPT` is the only process that may set `Claim.status`.
- `UPDATE` atomically closes at most one interval and opens at most one
  interval per slot, and writes exactly one `StateTransition`. It writes no
  lifecycle field.

### D5. User assertion is an acceptance policy

The runtime user-assertion gate becomes identified policy `user-assertion-v1`.
It may contribute to `ACCEPT`. It must not write `keepAlive`, memory
strength, activation, or bindings. Analyzer confidence still cannot accept.

### D6. Conflicts are retained and answerable

A `conflict` reconcile outcome marks competing claims `contested` for the
affected interval. That interval has no accepted binding. The system answers
with both attributions. Recency and memory strength must not resolve it.
Discarding the conflicting proposal is a defect.

### D7. Read path

- Direct slot/entity/exact match: memory state plays no eligibility role.
- Associative expansion (relation depth ≤ 1, similarity): dormant evidence is
  normally excluded, with an explicit reason.
- `PROJECT` writes nothing. `REINFORCE` / `WEAKEN` / `DECAY` / `REACTIVATE`
  are named processes with a recorded caller and run after the read.
- Memory strength is prohibited in direct-match scoring.
- Tags define scope and discovery. A tag miss is never a truth or
  direct-match eligibility decision.
- History intent reads closed intervals. Closed intervals are unreachable
  under any other intent.

### D8. Typed projection payload

The model-facing payload is the sectioned contract in model §9.3. A flat list
of propositions is not acceptable. Runtime IDs, knowledge IDs, lifecycle
numbers, retrieval scores, and audit records never appear in that payload.

### D9. 100% gap close

The program is complete only when all of the following hold:

1. V1–V15 in the gap analysis are closed in owning documents and code.
2. S1–S10 pass against the in-memory knowledge engine.
3. S1–S10 pass against SQLite with identical results (M7; blocked until 2).
4. Live CLI/ACP composition uses the new engine without reintroducing V3, V4,
   or V7.
5. `docs/SEMANTIC_MEMORY.md` describes the accepted model as implemented;
   `KnowledgeItem` is documented as a compatibility surface or is gone.

Live provider calls, paid NVIDIA tests, OpenHands mutation, and desktop
packaging remain out of scope for this program.

### D10. Task split (claimed identities)

| Phase | Task | Charter |
| --- | --- | --- |
| Program | A008-0021 | close knowledge-model gap to 100% |
| M0 | A008-0022 | adopt the model (this ADR) |
| M1 | A008-0023 | repair direct-match retrieval eligibility |
| M3 | A008-0024 | introduce semantic addressing |
| M4 | A008-0025 | split state from history |
| M5 | A008-0026 | first-class evidence and acceptance |
| M6 | A008-0027 | lifecycle on evidence only; retrieval intents |
| M7 | A008-0028 | storage redesign |

M2 is not a task. M7 must not start until M6 is green.

### D11. Integration rules for this program

- Product identity is A008. Historical archive filenames under
  `docs/finished/` and `docs/evidence/` that still say A007 remain provenance
  and are not renamed by this program.
- Writing clones live under `C:\code\A008-workers`. Each writing worker gets
  one claimed identity, one frozen charter, one branch, one clone, one
  non-overlapping write scope.
- Operational concurrent-writer cap for this program is eight, per owner
  instruction 2026-09-02. `docs/MULTIAGENT.md` advisory five remains until a
  process layer enforces a limit.
- Only the operator merges to `main`. Workers commit, push, write a handoff
  under `docs/handoffs/`, and open a pull request. Code plus that handoff is
  the integration evidence; worker transcripts are not.

## Alternatives considered

### Grow `KnowledgeItem` until the scenarios pass

Rejected. That is how V1–V4 were produced. Model §12 and gap analysis §6
forbid it.

### Replace the v0 engine in one slice

Rejected. The atomic repository port, exact budgets, ID-free classifier
envelope, reasoning isolation, and sequential commit survive and must keep
their tests green while the new engine is proven in-memory.

### Keep the five-way classifier as the truth machine

Rejected. It asks one model call to decide both "same meaning?" and "did the
world change?" without a slot. RECONCILE is a slot state machine.

### Design SQLite tables first

Rejected. Model §12. Storage follows passing in-memory scenarios.

### Treat dormant/active as the problem being solved

Rejected. The missing knowledge-semantics layer is the cause. Eligibility
repair (M1) is necessary and insufficient.

## Consequences

- Child tasks implement the model; they do not reopen D1–D11.
- Discoveries required by a frozen child charter become checklist steps.
  Discoveries that block the charter pause the parent and spawn a bounded
  child. Useful later work goes to `docs/backlog/`. Outside direction goes to
  `docs/concepts_sandbox/`.
- ADR 0005's rule that only activated records cross the context boundary is
  withdrawn for direct state matches. ADR 0007's `canonical_status = current`
  hard filter and dormant-exclusion from execution context are withdrawn for
  the history intent and for direct matches. ADR 0010's five-way relation set
  as canonical transition authority is withdrawn; `SemanticMemory.reconcile`
  remains the v0 compatibility owner until M4 cutover. ADR 0014's write-path
  restatement/extend boost remains until M6 replaces it with named `REINFORCE`
  on evidence only; projection reinforcement stays zero.
