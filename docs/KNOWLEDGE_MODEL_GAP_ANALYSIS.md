# Knowledge Model Gap Analysis

Status: Accepted analysis. Implementation authority is
[ADR 0018](adr/0018-knowledge-and-memory-model.md) and parent A008-0021.
Identities below are claimed. M2 is not a task; clocks land on new types.

Scope: what in the A008 source as of 2026-09-01 conflicts with
[`KNOWLEDGE_MEMORY_MODEL.md`](KNOWLEDGE_MEMORY_MODEL.md), what must change,
what survives unchanged, and in what order the change is safe.

Method: read of `src/memory/`, `src/orchestration/`, `src/runtime/`, and
`docs/`. Every finding names the file and symbol it was observed in. No code
was changed.

---

## 1. What exists today, stated fairly

A008 has one knowledge record type, `KnowledgeItem`
(`src/memory/types.ts`), carrying four concerns at once:

| Concern | Fields |
| --- | --- |
| Identity and semantics | `id`, `proposition`, `kind`, `tags`, `scope` |
| Canonical lifecycle | `canonicalStatus`, `supersededBy`, `revision` |
| Activation lifecycle | `activationStatus`, `relevanceScore`, `activationThreshold`, `keepAlive` |
| Trust and provenance | `authority`, `confidence`, `sourceBacked`, `provenance` |

Around it there is a genuinely careful machine: an atomic repository port with
audit separation, a bounded five-channel retrieval funnel, an exact serialized
budget, an ID-free classifier envelope, reasoning isolation, and sequential
commit with explicit partial failure. That machinery is good and most of it
survives.

The problem is not the machinery. The problem is that the record it operates
on conflates meaning, truth, time and salience into one row, and the pipeline
has no way to be correct on top of it.

---

## 2. Violations

Ordered by consequence. `L*` refers to the laws in
[`KNOWLEDGE_MEMORY_MODEL.md` §1.1](KNOWLEDGE_MEMORY_MODEL.md#11-laws).

### V1 — Knowledge identity is a sentence (L1)

`KnowledgeItem.proposition: string` (`types.ts:11`) is the unit of identity,
deduplication, comparison, and search:

- intake deduplicates on `kind + proposition`
  (`post-output-knowledge-intake.ts:298`);
- the relation classifier compares propositions, not addresses
  (`relation-gated-memory-commit.ts`, `classifierCandidate`);
- FTS indexes `proposition` (`sqlite-memory-repository.ts`, `A008_memory_fts`);
- `extend` overwrites `proposition` in place while keeping the id
  (`memory-engine.ts`, `merged.proposition`), silently changing what a record
  means without changing what it is.

**Required change.** Introduce slot addressing (model §3). `proposition`
becomes a human-readable `label` on evidence records, never an identity, never
a dedup key, never a comparison key.

**Consequence if unfixed.** "Brittans hus är vitt", "huset målades rött" and
"huset är grönt" remain three unrelated strings that only a language model can
relate. Every scenario in model §11 fails.

---

### V2 — Truth versioning is a per-record flag (L10)

`CanonicalStatus = "current" | "superseded"` with `supersededBy`
(`types.ts:15-16`). A supersede creates a new record with a new id and chains
the old one (`memory-engine.ts:311-334`). `historyFrom` walks that chain
(`in-memory-repository.ts:177`, `sqlite-memory-repository.ts:243`).

There is no slot, no value, and no interval. The history of a house's colour is
a linked list of sentences, and nothing in the model can say *when* white
stopped being true.

**Required change.** Remove `canonicalStatus` and `supersededBy` from the
knowledge record. Current is `validTo = null` on a slot binding; history is the
interval list; supersession stops existing as a concept (model §5.3).

---

### V3 — A canonical transition writes a memory state (L5, L7)

`memory-engine.ts:313-319`:

```ts
const historical: KnowledgeItem = {
  ...target,
  canonicalStatus: "superseded",
  supersededBy: replacement.id,
  activationStatus: "dormant",     // <-- truth decision writing memory state
  revision: target.revision + 1,
};
```

This is `canonical_status != memory_state` violated in four lines. A truth
transition reaches into the memory lifecycle and forces dormancy.

**Required change.** `UPDATE` closes an interval and writes a transition. It
touches no lifecycle field on anything (model §10.1).

---

### V4 — Direct state reads are gated by memory state (L6, L8)

Three gates, all of which will suppress a true, current, directly matched fact:

| Location | Gate |
| --- | --- |
| `hybrid-memory-reader.ts:165` | `projectionEligible` requires `activationStatus === "active"` |
| `hybrid-memory-reader.ts:200` | omission reason `persistent_activation_dormant` |
| `memory-engine.ts:473` | `eligible = relevant.filter(activationStatus === "active")` |
| `memory-engine.ts:479, 603` | `required_not_eligible` thrown for dormant required/keep-alive canon |
| `memory-engine.ts:613` | `projectSelected` admits only active items |

Scenario S6 of the model fails here today: `brittans_hus.color = green` with
dormant supporting evidence cannot cross the projection boundary, so the system
cannot answer a direct question with a fact it holds.

`SEMANTIC_MEMORY.md` states this as intended behaviour — "Dormant records can
appear in candidate evidence but cannot cross the projection boundary". That
sentence is the bug, written down.

**Required change.** State has no memory state (model §7.1), so this gate
cannot apply to it at all. For evidence, dormancy filters associative expansion
only (model §8.1). `required_not_eligible` disappears for direct matches.

---

### V5 — History is structurally unreachable from the read path (L10)

- Every candidate channel hard-filters `canonical_status = 'current'`
  (`sqlite-memory-repository.ts:750, 785, 818, 851, 889`).
- The reader throws `illegal_state` if the index ever returns a non-current
  record (`hybrid-memory-reader.ts:126`).
- `historyFrom` is reachable only through the explicit `getHistory(id)` API,
  which requires already knowing an id.
- The planner *computes* temporal hints — `currentOnly`, `mentionsPast`,
  `mentionsFuture` (`deterministic-retrieval-planner.ts:228-231`) — and nothing
  anywhere consumes them. `relation-candidate-source.ts:180` hardcodes
  `currentOnly: true`.

So "Vilka färger har huset haft?" has no path through the system, even though
the data exists and the planner already detected the intent.

**Required change.** Retrieval intents (model §8.2) with a history surface that
reads closed intervals, and consumption of the temporal hints that are already
being computed.

---

### V6 — `retrieval_score` contains `memory_strength` (L5)

`hybrid-retrieval-policy.ts:92` gives `strength` a default weight of `0.05`,
and `hybrid-memory-reader.ts:53` mixes `item.relevanceScore` into the candidate
score for every channel, including exact matches.

A weakly-remembered exact hit therefore scores lower than a strongly-remembered
fuzzy one, on a direct question.

**Required change.** Memory strength is prohibited as a term in direct-match
scoring and permitted only in associative expansion (model §8.3).

---

### V7 — Reads mutate memory (L11)

`SemanticMemory.project()` applies `policy.projectionReinforcement`
(`memory-engine.ts:448`), recomputes activation, bumps `revision`, and writes
inside the read transaction. Retrieval is a write.

`projectSelected` is correctly non-mutating, and ADR 0014 moved live
reinforcement to the write path — but `project()` still exists with the old
behaviour, and the reinforcement decision is still a policy side effect rather
than a named process with a named caller.

**Required change.** `PROJECT` writes nothing. `REINFORCE` is explicit, invoked
after use, and records its caller and reason (model §10.2, §10.3).

---

### V8 — There is no time (L1, §4)

`KnowledgeItem` has no `eventTime`, no validity interval, no `assertedAt`, no
`ingestedAt`. `revision` is a concurrency counter, not a clock.

Everything time-shaped in the current model is therefore encoded as ordering in
a supersede chain, which cannot express "the house was red between T1 and T2",
cannot express a forecast, and cannot distinguish learning order from world
order.

**Required change.** The four clocks of model §4, with `unknown` as an explicit
value.

---

### V9 — Utterance and speech act do not exist (L2, L3)

`ProvenanceRef` is `{ sourceId, sourceType }` (`types.ts:4-7`), merged into the
knowledge record as a sorted set. There is no speaker, no speech act, no
assertion time, and no separation between "someone said X" and "the system
holds X".

Worse, acceptance is currently implemented as a *trust heuristic inside an
activation gate*. `runtime/user-assertion-gate.ts` detects that the user's
message literally contains the proposition and then sets:

```ts
keepAlive: true,
sourceBacked: true,
authority: max(authority, 0.8),
provenance: [{ sourceId: "user-message", sourceType: "user-assertion" }],
```

That is an acceptance policy (L3) expressed as a memory-pinning decision (L5),
triggered by substring matching. It works today because there is nowhere else
for acceptance to live.

**Required change.** `Utterance` and `Claim` become first-class records
(model §6), and `ACCEPT` becomes a named process with an identified policy
(model §10.1). The user-assertion rule becomes one acceptance policy among
several, and stops touching `keepAlive`.

---

### V10 — The five-way relation set asks one question about two axes

`ReconciliationRelation = new | restatement | extend | supersede | conflict`
(`types.ts`). The classifier is handed two propositions and asked to decide, in
one shot, both *"do these mean the same thing?"* and *"did the world change?"*
— without ever being told which slot is being addressed, because slots do not
exist.

`restatement` and `extend` differ only in whether the stored sentence is
overwritten. `supersede` conflates "new value" with "old record demoted".

**Required change.** Split the decision (model §10.1):

- `INTERPRET` resolves entity and slot — the addressing question;
- `RECONCILE` decides against that slot's current binding —
  `re_assertion | change | correction | conflict | retraction | no_op`.

"Supersede" is not one of the outcomes. A new value is a `change`, which is a
state transition, which the classifier does not own.

---

### V11 — Conflicts are unrepresentable

`reconcile` with `decision.type === "conflict"` appends an audit event and
returns `{ item: null }` (`memory-engine.ts:287-299`). Canonical state is
unchanged and **the conflicting proposal is discarded entirely**. Nothing in
the retrieval path can ever surface a conflict, because conflicts are only in
the audit log, and the audit log is explicitly not context.

So the system can detect a contradiction and then forget it.

**Required change.** `contested` is a claim status on retained claims, the
affected interval has no accepted binding, and the conflict is answerable
(model §5.3, scenario S8).

---

### V12 — `kind`, `tags` and `scope` carry too many jobs (L9)

- `kind: string` is unconstrained and simultaneously stands for the
  ontological type and the content kind.
- `tags` are a *relevance gate*: `CodingAgentMemoryPolicy.isRelevant`
  (`coding-agent-policy.ts:49-53`) requires `scopeMatches && termMatches`, so a
  tag miss makes true, current knowledge invisible to a task.
- `scope` is both a namespace and an applicability filter.

**Required change.** Separate ontological type (model §2.1), `contentKind`
(model §2.3), and tags-as-scope (L9). Tags define discovery; a tag miss is an
applicability decision, never a truth or eligibility decision, and never
applies to a direct slot match.

---

### V13 — The projection payload is a flat list of sentences

`ContextKnowledgeItem` is `{ id, proposition, kind, tags, scope, authority }`
(`types.ts:81-88`), serialized as `{ taskId, items: [...] }`.

The model receiving that payload cannot distinguish an accepted current fact
from an attributed third-party claim from a past value, because the payload has
no such structure. Scenarios S4 and S5 cannot be satisfied by any prompt
wording on top of this shape.

**Required change.** The typed sectioned payload of model §9.3, with intervals
on history, attribution and status on claims, and speaker and speech act on
utterances.

---

### V14 — Strength only ever increases

`projectionReinforcement` (+0.25) and `reconciliationReinforcement` (+0.2) both
add, clamped to 1. There is no decay, no weakening, and no sweep;
`CURRENT_STATUS.md` records this as "Cyclic weaken/decay is not implemented".

Every record therefore drifts toward `active`, which makes the dormancy gates
of V4 fire mainly on records that were never used — the opposite of a memory
model.

**Required change.** `DECAY` / `WEAKEN` as named processes (model §10.3), once
lifecycle applies only to evidence and can no longer suppress state.

---

### V15 — `relevanceScore` is misnamed and overloaded

One field is used as: memory strength (lifecycle), a retrieval scoring term
(`weights.strength`), a ranking tiebreaker (`CodingAgentMemoryPolicy.
rankForContext`), and an activation input (`activationFor`).

**Required change.** `memoryStrength` on the evidence lifecycle record;
`retrievalScore` per query, ephemeral, never persisted; ranking and activation
read them separately.

---

## 3. What survives unchanged

This is not a rewrite of the runtime. The following are correct and should be
carried forward as-is:

- **Project namespace as a hard boundary.** Validated `ProjectId` narrowing
  storage and retrieval; task scope may narrow, never broaden.
- **The atomic repository port.** Transaction callback over a working copy,
  full-state validation before commit, audit written in the same transaction.
- **Exact serialized budgets with explicit failure.** Required material that
  does not fit fails loudly instead of vanishing.
- **The ID-free classifier envelope.** Local `candidate_N` handles, no durable
  ids, no write capability, revision guards checked inside the canonical
  transaction. This extends cleanly to slot-addressed candidates.
- **Reasoning isolation** (ADR 0015). Reasoning has no path to knowledge.
- **Staging without write authority** (ADR 0009). This is already the
  `INGEST` / `INTERPRET` boundary of the new model, under a different name.
- **The five-channel candidate funnel.** Exact, lexical, tag, domain, semantic
  — correct as *evidence* retrieval; it needs one more channel (slot-exact) and
  must stop being the only path.
- **Sequential commit with checkpoints and explicit partial failure.**
- **Debug trace and evidence kept out of context.**

---

## 4. Migration

Sequenced so that each phase is independently verifiable and no phase requires
the next one to be correct. Phases M1 and M2 are safe under the *current*
model; the model change starts at M3.

### M0 — Adopt the model

Accept `KNOWLEDGE_MEMORY_MODEL.md` via ADR. The ADR amends 0005, 0007, 0010 and
0014 rather than superseding them wholesale, since their runtime boundaries
survive.

*Gate:* ADR accepted, index updated, model doc referenced from
`SEMANTIC_MEMORY.md`.

### M1 — Stop the read path from lying (V4, V6, V7)

Pure defect repair, no schema change:

- remove the `activationStatus === "active"` gate from projection eligibility
  in `hybrid-memory-reader.ts` and `memory-engine.ts`, for exact/direct-channel
  hits;
- keep the gate for associative hits only, and record the distinction in the
  candidate's reasons;
- set `weights.strength = 0` for exact-channel candidates;
- make `project()` non-mutating and move reinforcement behind an explicit call.

*Gate:* a regression test in which a dormant, exact-matched record is returned
for a direct question, and a dormant 1-hop record is not returned for an
associative one. Scenario S6 and S7 in reduced form.

### M2 — Add time, additively (V8)

Add `eventTime`, `assertedAt`, `ingestedAt` and a validity interval to the
existing record without removing anything. Populate on write. Nothing reads
them yet.

*Gate:* every existing test still green; new records carry all four clocks;
`unknown` is representable and round-trips.

### M3 — Semantic addressing (V1, V10 first half)

Introduce `Entity`, `SlotDefinition`, and slot resolution in `INTERPRET`.
`proposition` is retained as `label`. New writes address a slot; old records
are addressable through a compatibility slot derived from `kind + entities`.

*Gate:* scenario S3 (source code) produces one artifact, one symbol and typed
relations rather than three strings.

### M4 — State and history split (V2, V3, V10 second half, V11)

Introduce bindings, intervals and `StateTransition`. Rewrite `RECONCILE` to
decide against a slot. Remove `canonicalStatus` and `supersededBy`. Introduce
claim status including `contested`.

This is the breaking phase and needs a data migration of existing supersede
chains into intervals — with unknown boundaries recorded as `unknown`, not
invented.

*Gate:* scenarios S1, S2, S8, S10.

### M5 — Evidence as first class (V9, V13)

`Utterance`, `Claim`, `Provenance` records; `ACCEPT` as a named process with an
identified policy; the user-assertion rule reduced to one acceptance policy.
Typed sectioned projection payload.

*Gate:* scenarios S4, S5, S9. The prayer case is the sharpest test: it must
produce a recitation record and no claim.

### M6 — Lifecycle where it belongs (V5, V12, V14, V15)

Lifecycle moves off state and onto evidence only. `DECAY` / `WEAKEN` /
`REACTIVATE` as named processes. Retrieval intents and the history surface,
consuming the temporal hints that already exist. `memoryStrength` /
`retrievalScore` split.

*Gate:* the full scenario suite of model §11, plus a decay sweep that changes
no answer to any direct question.

### M7 — Storage

Only now. Interval tables, slot indexes, FTS over labels, embeddings, and the
real migration.

*Gate:* the whole suite passing against the in-memory reference first, then
against SQLite with identical results.

---

## 5. Recommended task split

Following `docs/TASK_WORKFLOW.md`. Identities are suggestions; claim them in
`docs/TASK_IDS.md` on `main` before any charter goes to Ready.

| Phase | Claimed charter | Notes |
| --- | --- | --- |
| Program | A008-0021 close knowledge-model gap | Parent; operator merges to `main` |
| M0 | A008-0022 adopt knowledge and memory model | ADR 0018; documentation only |
| M1 | A008-0023 repair direct-match retrieval eligibility | Bug fix on v0 path |
| M2 | not a task | Clocks land on new types (ADR 0018 D3) |
| M3 | A008-0024 introduce semantic addressing | First model change; new tree |
| M4 | A008-0025 split state from history | Breaking; blocked on M3 |
| M5 | A008-0026 first-class evidence and acceptance | Depends on M3 |
| M6 | A008-0027 lifecycle on evidence only, retrieval intents | Depends on M4, M5 |
| M7 | A008-0028 storage redesign | Blocked until M6 is green |

M1 is worth doing on its own regardless of when the rest lands: it is a
correctness defect in shipped behaviour, it is small, and it is required by the
model anyway.

---

## 6. What must not happen next

- Do not design SQLite tables, indexes, FTS or embedding columns yet
  (model §12).
- Do not add fields to `KnowledgeItem` to paper over V1–V4. Every field added
  to that record makes M4 harder.
- Do not let the relation classifier keep deciding truth versioning. It is a
  semantic comparator, not a state machine.
- Do not treat `active`/`dormant` as the problem being solved. The
  active/dormant defect is a symptom; the missing knowledge-semantics layer
  between raw information and memory lifecycle is the cause.
