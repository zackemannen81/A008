# Knowledge and Memory Model

Status: Accepted. Authority: [ADR 0018](adr/0018-knowledge-and-memory-model.md).
Implementation proceeds through A008-0021 children; storage remains deferred
until §11 passes in-memory.

Owns: what A008 knowledge means, what exists in the model, what is versioned,
what truth is, what memory is, and what each process may and may not change.

Does not own: storage layout, table design, index strategy, embedding
configuration, provider selection, packaging. Those are deliberately deferred;
see [§12](#12-storage-deliberately-deferred).

Relates to: [`SEMANTIC_MEMORY.md`](SEMANTIC_MEMORY.md) describes what exists
today. This document describes what the model must become. The differences are
enumerated in
[`KNOWLEDGE_MODEL_GAP_ANALYSIS.md`](KNOWLEDGE_MODEL_GAP_ANALYSIS.md).

Amends or supersedes on acceptance: ADR 0005 (state boundary), ADR 0007 (read
path eligibility), ADR 0010 (relation set), ADR 0014 (read-path
reinforcement).

---

## 0. Reading order

This document is written in dependency order. Each layer may only depend on
the layers above it.

```text
CONSTITUTION        the laws that cannot be traded away
      |
ONTOLOGY            what kinds of things exist
      |
SEMANTIC ADDRESSING what is identified, and what is versioned
      |
TIME                which clocks exist
      |
TRUTH / STATE       what the system currently accepts, and what held when
      |
EVIDENCE            what was said, what happened, what is claimed
      |
MEMORY / LIFECYCLE  what fades, strengthens, and is spontaneously recalled
      |
RETRIEVAL           what may enter a controlled context, and why
      |
COMPOSITION         where it appears and in what order
      |
WRITE / RECONCILE   how new information becomes state
      |
PROJECTION          what the model is actually shown
      |
STORAGE             deferred on purpose
```

Any change that reverses this order is a defect in the change, not in the
model.

---

## 1. Constitution

These are the laws. Every later section, every process contract, and every
implementation decision is subordinate to them.

### 1.1 Laws

**L1. Knowledge models meaning, not sentences.**
The unit of knowledge is an addressable semantic fact, not a natural-language
string. Two different sentences expressing one fact are one fact. One sentence
expressing three facts is three facts.

**L2. A source is not knowledge.**
An artifact, a message, or a document is a container. Its existence asserts
nothing.

**L3. A statement is not automatically truth.**
The system can record that a speaker asserted X without accepting X.
Acceptance is a separate, explicit, policied act.

**L4. A retrieved item is not automatically relevant.**
Retrieval eligibility, task applicability, and inclusion in a controlled
context are three separate decisions.

**L5. A memory's salience is not its truth state.**
How strongly something is remembered says nothing about whether it is true,
current, or accepted.

**L6. Current semantic state does not have to be remembered in order to remain
current.**
State is materialized, not recalled. A fact the system would not spontaneously
volunteer is still the fact it will answer with when asked directly.

**L7. Memory lifecycle applies to the information from which state was
established, never to the state itself.**
Utterances, events and claims decay. Slot bindings and state transitions do
not.

**L8. Dormancy controls spontaneous recall, not eligibility for a direct
match.**
A direct semantic-address match must reach dormant knowledge. Only associative
expansion may use dormancy as a filter.

**L9. Tags define scope and discovery.**
Tags never define truth, never gate correctness, and are never themselves the
retrieval result.

**L10. History is not degraded knowledge.**
A past value is historically correct state over a past interval. It is not a
"superseded" or lesser record.

**L11. Retrieval is non-mutating.**
Reading never changes strength, activation, state or history. Every lifecycle
change happens in a named process with an explicit caller.

**L12. Every accepted state has a traceable path back to evidence.**
No accepted binding may exist without at least one claim, and no claim without
at least one utterance, event or artifact.

### 1.2 Inequalities

These are the confusions the model exists to prevent. Each one is a test that
can be written.

```text
canonical_status   !=  memory_state
memory_strength    !=  truth
retrieval_score    !=  memory_strength
source_statement   !=  canonical_fact
claim              !=  accepted knowledge
event              !=  derived fact
assertion_time     !=  event_time            !=  validity_interval
tag match          !=  relevance
relevance          !=  inclusion
history            !=  supersession
```

### 1.3 What each surface answers

| Surface | Question it answers |
| --- | --- |
| Current semantic state | "What does the system currently accept as the case?" |
| State history | "What was the case, and over which interval?" |
| Event record | "What happened, who did it, when, where, how, why?" |
| Utterance record | "Who said what, in what speech act, when?" |
| Claim status | "Is this asserted, accepted, contested, rejected, or retracted?" |
| Memory state | "How readily should this be recalled without being asked?" |
| Task applicability | "Is this relevant to the question currently being answered?" |
| Provenance | "Where did this come from?" |

No surface may be asked to answer another surface's question.

---

## 2. Ontology

### 2.1 The kinds that exist

| Kind | Role | Example |
| --- | --- | --- |
| `Artifact` | A bounded external container | `main.cpp`, a chat message, a recording |
| `Entity` | A referent that can bear attributes and relations | `main()`, `Rickard`, `rickards_bil`, `brittans_hus`, `Mantorp` |
| `AttributeBinding` | A value bound to an entity's attribute slot | `car.color = blue`, `main.return_type = int` |
| `RelationshipBinding` | A relation between entities | `Rickard --owns--> car`, `main.cpp --contains--> main()` |
| `Event` | Something that occurred, optionally with effects on slots | `fire_in_Mantorp`, `rickard_called_stefan`, `house_painted_red` |
| `Utterance` | A speech act by a speaker | Kanal 4 presenter predicting rain |
| `Claim` | A proposition with certainty and attribution, which may or may not be accepted | `rain(tomorrow), certainty=probable` |
| `Provenance` | The link from any record back to its origin | claim → utterance → artifact |

### 2.2 Classification of the kinds

Three groups, with different rules:

```text
REFERENTIAL      Artifact, Entity
                 have identity; are not true or false; do not decay

STATE            AttributeBinding, RelationshipBinding
                 are true over an interval; have no memory lifecycle

EVIDENCE         Utterance, Event, Claim, Provenance
                 are records of what was said, happened, or asserted;
                 have a memory lifecycle; do not by themselves change state
```

The single most important structural rule in this document:

> **State records and evidence records are different records with different
> lifecycles. An implementation that stores them as one record type will
> reproduce every confusion this model was written to remove.**

### 2.3 Content kinds and semantic dimensions

`who / what / where / when / how / why` are **extraction targets and query
dimensions**, not mandatory fields. Making them mandatory produces a world of
`who: null`.

A record declares a `contentKind`, and the `contentKind` declares which
dimensions are meaningful:

| contentKind | Meaningful dimensions | Not meaningful |
| --- | --- | --- |
| `source_code` | artifact, language, symbols, containment relations | who, why |
| `event_report` | who, what, where, when, how, why | — |
| `forecast` | what, when, certainty, attribution | how |
| `prayer` / `recitation` | speech act, attribution, content text | truth value of the content |
| `instruction` | what, who it binds, scope | where |
| `dialogue_assertion` | who, what, when asserted | where |

Rules:

- A dimension that is not meaningful for a `contentKind` is absent, not null.
- A dimension that is meaningful but unknown is explicitly `unknown`.
- `contentKind` is not the ontological kind. A `source_code` artifact still
  produces `Entity`, `RelationshipBinding` and `AttributeBinding` records.

---

## 3. Semantic addressing

### 3.1 The addressable unit

Knowledge is addressed by **slot**, not by sentence and not by record id.

```text
attribute slot     (entityId, attribute, name)
                   brittans_hus . color
                   main         . return_type

relation slot      (subjectId, relation, name, objectId?)
                   rickard --owns--> ?
                   main.cpp --contains--> main()
```

A slot is a stable address. What changes over time is the **binding** on that
slot.

```text
ENTITY            brittans_hus            persists
SLOT              brittans_hus.color      persists
BINDING           white / red / green     changes over time
```

### 3.2 Cardinality

A slot declares its cardinality:

- `single` — at most one accepted binding at any instant.
  `brittans_hus.color`, `main.return_type`
- `set` — many simultaneous accepted bindings, each with its own interval.
  `main.cpp --contains--> {main(), helper()}`

Consequences:

- Two accepted bindings on a `single` slot with overlapping intervals is a
  **conflict**, not a supersession.
- Removing one member of a `set` slot closes that member's interval; it does
  not touch the other members.

### 3.3 What is versioned

Not entities. Not documents. Not "memories".

> **The binding on a slot is what is versioned.**

This is what prevents the failure mode:

```text
BAD                                     GOOD
memory 1: the house is white            brittans_hus.color
memory 2: the house was painted red       white  [T0, T1)
memory 3: the house is red                red    [T1, T2)
memory 4: the house is green              green  [T2, -)
four loosely related texts              one slot, three intervals

                                        plus, separately:
                                        event: brittan painted the house red @T1
```

### 3.4 Identity resolution

Slot addressing only works if entity identity is resolved. Rules:

- Entity resolution is an explicit step in `INTERPRET`, with its own
  confidence, and it may fail.
- A failed resolution produces an unresolved-reference record, not a guessed
  binding.
- Two entities are never merged implicitly. Merging is an explicit operation
  with its own record and its own reversal path.
- Entity identity is never derived from a natural-language label alone.

---

## 4. Time

### 4.1 The clocks

Four distinct times. Conflating any two of them reintroduces the problem this
model removes.

| Clock | Meaning |
| --- | --- |
| `eventTime` | When the thing happened in the world |
| `validInterval` | `[validFrom, validTo)` — when a binding held |
| `assertedAt` | When the source made the statement |
| `ingestedAt` | When the system recorded it |

### 4.2 Rules

- `validTo = null` means *still holding*. That is what "current" means. There
  is no separate current flag on a record.
- An unknown time is stored as `unknown`, never defaulted to now.
- `ingestedAt` is system bookkeeping. It must never be used as a proxy for
  `eventTime` or `validFrom` in any answer.
- Learning order and world order are independent. Learning about the white
  house after learning about the green house does not change the intervals.
- A record with `eventTime` in the future (a forecast) is a claim about a
  future interval; it never opens a current-state binding.

---

## 5. Truth and state

### 5.1 Two structures

```text
CURRENT SEMANTIC STATE      the materialized set of bindings with validTo = null
                            "What is currently accepted?"

STATE HISTORY               the ordered intervals per slot, plus the
                            transitions that produced them
                            "What was the case, when, and what caused it?"
```

Current state is a **materialized projection of the history**, not a separate
truth. It is derived, deterministic, and cheap to read.

### 5.2 State transitions are atomic

```text
meaningful input
      |
semantic interpretation
      |
event / assertion / evidence
      |
ATOMIC SEMANTIC STATE UPDATE
      |
current world state
```

and, going the other way, the original information is retained:

```text
event / assertion / evidence
      |
history / provenance
      |
memory lifecycle
```

One `UPDATE` closes at most one interval and opens at most one interval per
slot, and writes exactly one `StateTransition` record:

```text
StateTransition
  slot        brittans_hus.color
  from        red
  to          green
  at          T2
  causedBy    assertion:a-91          (or event:e-17)
  decidedBy   accept-policy:v1
```

### 5.3 `canonicalStatus` is removed

There is no `current | superseded` flag on a knowledge record.

- "Current" is `validTo = null`.
- "Historical" is `validTo != null`.
- Neither is a judgement about the record's quality.

What remains as an explicit status belongs to **claims**, not to state:

| Claim status | Meaning |
| --- | --- |
| `asserted` | Recorded and attributed. Not accepted. |
| `accepted` | Accepted by policy; may drive a state transition. |
| `contested` | Two or more accepted-eligible claims disagree on one slot/interval. |
| `rejected` | Explicitly not accepted; retained with the reason. |
| `retracted` | The source withdrew it. |

A `contested` slot has no accepted binding for the contested interval. It is
answerable — "the system holds two conflicting accounts" — and must never
silently resolve itself by recency or by strength.

### 5.4 Change is not correction

Two operations that must never be collapsed into one:

| | `CHANGE` | `CORRECTION` |
| --- | --- | --- |
| Means | The world changed | The record was wrong |
| Example | "Brittan painted the house red" | "It was never white, I misremembered" |
| Effect | Closes an interval, opens a new one | Rewrites a past interval's value |
| History | Both intervals remain true | The corrected interval is amended, with a correction record retained |
| Requires | An event or a new assertion | An explicit correction claim about a past interval |

An implementation that treats every new value as a `CHANGE` will slowly turn
its own mistakes into fictional history.

---

## 6. Evidence

### 6.1 Utterance

An utterance is a speech act. It is first class.

```text
UTTERANCE
  speaker        Kanal 4 presenter
  act            prediction
  contentKind    forecast
  content        "it will probably rain tomorrow"
  assertedAt     T
  artifact       broadcast:2026-09-01
```

Speech acts include at least: `assertion`, `question`, `prediction`,
`instruction`, `recitation`, `performative`, `hypothetical`, `quotation`.

Rules:

- `recitation`, `quotation` and `hypothetical` never produce claims about the
  world. Reciting "Fader vår som är i himmelen" records a recitation; it does
  not assert anything about where the speaker's father lives.
- A `question` never produces a claim.
- A `prediction` produces a claim about a future interval with a certainty,
  never a current-state binding.

### 6.2 Claim

A claim is the bridge from evidence to state.

```text
CLAIM
  proposition    slot binding | event occurrence | negation
  certainty      certain | probable | possible | unlikely
  attributedTo   speaker / agent
  derivedFrom    utterance | event | artifact
  aboutInterval  [from, to)
  status         asserted | accepted | contested | rejected | retracted
```

> `Stefan asserts X` and `the system accepts X` are two different records.
> The first is always written. The second is only written by `ACCEPT`.

This is what lets the system answer "who said what?" with no hacks, and lets
it hold a claim it does not believe.

### 6.3 Event

```text
EVENT
  type            house_painted
  who             brittan            (participants)
  what            paint              (action / object)
  where           -                  (absent if not meaningful)
  when            T1                 (eventTime)
  how             -
  why             -
  effects         [ brittans_hus.color := red @ T1 ]
```

An event's `effects` are *proposed* state transitions. They only become state
through `ACCEPT` and `UPDATE`. An event is never duplicated as a derived fact:
there is one event record and one transition, not an event record plus a
free-floating "the house is red" memory.

### 6.4 Provenance

Provenance is a relation, not a bag of fields on the knowledge record:

```text
(claim)   --derived_from-->  (utterance)
(utterance) --appears_in-->  (artifact)
(binding) --caused_by-->     (transition) --caused_by--> (claim | event)
```

Provenance is queryable and auditable. It is never part of the model-facing
context payload unless the task's intent is attribution.

---

## 7. Memory and lifecycle

### 7.1 Scope of the lifecycle

Applies to: `Utterance`, `Event`, `Claim`, and artifact-level summaries.

Does **not** apply to: `AttributeBinding`, `RelationshipBinding`,
`StateTransition`, current state, `Entity`, `Artifact` identity.

> A binding has no `memoryStrength`. Asking "how strongly is
> `brittans_hus.color = green` remembered" is a category error: it is the
> materialized state the system uses, not something it recalls.

### 7.2 The lifecycle record

Implemented L2 amendment: [ADR 0035](adr/0035-frozen-instruction-and-memory-target.md), P1-P5.

```text
MemoryLifecycle
  severity          critical | important | minor | null (unclassified)
  policyVersion     exponential-v1 | legacy-exponential-v1
  strength          stored baseline, 0..1
  strengthUpdatedAt operational UTC timestamp, independent of world clocks
  decayLambda       finite >= 0, per second
  threshold         >0..1 (legacy zero is explicitly preserved)
  boost             stored recurrence increment, 0..1
  maximum           1
  pinned            boolean
  state             cache at baseline; never overrides evaluated activation
  lastReinforcedAt  real recurrence time or unknown
  creationOccurrenceId optional original occurrence; creation cannot boost itself
  decayRate         legacy explicit-maintenance rate; never exponential lambda
```

At one operation time, compute
`effective = strength * exp(-decayLambda * max(0, elapsedSeconds))`.
Activation is derived from `pinned || effective >= threshold`. Equality is
active; zero and underflow do not delete evidence. Backward clocks cannot grow
strength or move the next baseline earlier. Reads and inspection write nothing;
inspection distinguishes baseline strength/state from effective strength/state,
evaluation time and the optional absolute threshold crossing.

Only newly extracted claims receive semantic severity. The existing analyzer
must return the enum; staging reports/skips an invalid or missing enum per item.
Model-supplied lifecycle numbers do not choose policy. Critical starts at 1 with
a 365-day half-life, important at 0.8/90 days, minor at 0.4/14 days. Each uses
threshold 0.2, boost 0.2 and cap 1. Raw utterance/event/summary evidence remains
unclassified with strength 1, threshold 0.5, half-life 90 days and no inferred
pin. One day means 86400 seconds, not a calendar interval.

The existing global runtime preferences owner accepts the advanced
`memoryLifecycle` object (settings format 4, reading formats 1-3), validated by
`src/core/memory-lifecycle-policy.ts`. No new policy editor is introduced.
Existing clients saving only instructions/budgets preserve this object.
Operation snapshots and stored numeric policies prevent mid-operation changes
or retrospective reclassification. Changed settings affect later creations.
Changing existing records requires an explicit migration/rebase.

Automatic reinforcement needs an original message/source span, a semantically
supported relation and the exact existing claim resolved from that invocation's
handle map. The existing comparator judges support using the original source;
answer-only text, retrieval, questions, mere quotation, conflicts and unrelated
content do not establish recurrence. Runtime validates source ownership, span
bounds and the unchanged canonical target. Missing proof skips reinforcement
with a result diagnostic, while valid extraction can proceed.

Restatement reuses the canonical carrier when it does not require the existing
user-acceptance transition. Its new utterance retains attribution; source
repetition does not become a user assertion. Extend may reinforce only its
underlying target. Supersede/conflict and mechanical correction/retraction
cannot boost a displaced target. No substring/all-record reinforcement remains.

An original dialogue task/conversation or source locator/content determines a
stable occurrence identity. One occurrence/claim receipt, decayed boost, new
baseline and lifecycle audit commit atomically. Duplicate proposals/reimports,
retries, restart and concurrent delivery cannot repeat that pair's boost.
Receipts live in the existing project namespace. New evidence at the cap still
refreshes the baseline; a small boost below threshold remains dormant. Neither
reinforcement nor migration changes claim acceptance, state or historical clocks.

### 7.3 States versus transitions

```text
STATES        active | dormant

TRANSITIONS   created | reinforced | weakened | reactivated | decayed
```

Explicitly rejected:

- `memory_state = reactivated` — reactivation is a transition, not a state.
- `memory_state = superseded` — supersession is not a memory concept at all;
  it belongs to state history, and after §5.3 it does not exist as a status.

### 7.4 What dormancy does and does not do

```text
dormant  ==>  will not be volunteered spontaneously
dormant  =/=> untrue
dormant  =/=> unusable
dormant  =/=> ineligible for a direct match
```

### 7.5 Independent semantic associations

Implemented L3 amendment: [ADR 0035](adr/0035-frozen-instruction-and-memory-target.md),
P6. Association persistence is independent metadata beside `RelationIndex`, never
lifecycle on a `RelationshipBinding`, entity or evidence endpoint.

Identity is the enclosing project namespace plus canonical from/to IDs, the exact
semantic relation type and a sorted, duplicate-free applicability scope. Direction
is preserved; no current relation definition declares symmetry. Binding intervals
never identify this record. Changing direction, endpoint, relation or scope selects
a different edge. Domain/display/provenance links and co-occurrence are not
promoted into semantic associations by storage, graph inspection or retrieval.

The existing relation comparator may return independently supported associations.
Candidate claim handles and registry entity handles map to exact canonical IDs;
`proposal` resolves only to the actual committed/reused claim. The runtime never
creates an endpoint for an association. It revalidates captured endpoints after
asynchronous comparison and under the existing commit lock. If resolution fails,
it skips and reports that edge. This first live producer handles existing claims,
registry entities and the actual proposal; it does not infer missing entities or
add an extraction/classification call when intake produces no proposal.

Every edge update requires its own affirmative semantic support and non-empty
UTF-16 span in the original message or attributed source, with matching locator,
content, origin and valid bounds. Proposal/answer text, endpoint co-retrieval,
questions, mere quotation and traversal are not new evidence. Claim support and
edge support are independent: one occurrence may justify either or both, each
with its own receipt and proof. Strength writes never accept/reject a claim,
change confidence, establish a binding, resolve a conflict or rewrite world time.

An association stores `association-exponential-v1`, baseline strength,
`strengthUpdatedAt`, lambda, threshold, boost, cap and actual last-reinforcement
time (null at creation). The accepted creation policy is strength 0.4, half-life
45 days, threshold 0.2, boost 0.2 and cap 1. Day 45 is exactly active; after that
an unreinforced default edge is dormant. Evaluation uses the same pure arithmetic
as §7.2. Reinforcement first decays, then adds the stored boost and caps at 1;
backward time cannot move the baseline earlier. A new occurrence at cap refreshes
the baseline; a small boost can leave an edge dormant.

Creation and recurrence each record an occurrence/edge receipt and audit, in a
namespace separate from claim receipts. Atomic knowledge commit includes both
families and their source records. Duplicate delivery, retry and restart cannot
repeat an edge update. No receipt or baseline is written by reading, graph
rendering or endpoint retrieval. Runtime preferences' `association` category is
snapshotted per operation and stored per new edge. Older settings acquire the
default only for future creation; older clients omitting the category on save
preserve its current value. Changes to existing baselines require explicit rebase.

The one-hop consumer evaluates edge activity at the operation time and requires
an overlapping runtime applicability scope (or an unscoped edge). It then checks
endpoint evidence activity separately. Direct hits and independently eligible
routes survive a dormant edge. No strength multiplier or recursive propagation
is added. Legacy links lacking semantic identity/provenance remain untracked
with their previous traversal behavior. Later exact evidence initializes metadata
for that identity; an unscoped legacy link is replaced in traversal only by its
same unscoped identity. A differently scoped edge is a distinct route.

Inspection remains a read-only inventory: each record's existing detail includes
outgoing associations with stored and evaluated values. Scope variants retain
separate metadata while sharing one graph line. Model projections exclude this
metadata. Fixed-clock/source/transaction/recovery evidence is in
[association-lifecycle.test.ts](../test/knowledge-model/association-lifecycle.test.ts).

---

## 8. Retrieval

### 8.1 The eligibility rule

Two rules, and the distinction between them is the whole point:

```text
DIRECT MATCH                 (exact slot, exact entity, explicit scope match)
      |
memory state plays NO eligibility role
active and dormant are equally eligible
a direct hit may be reported as a diagnostic candidate; reading alone NEVER strengthens it

ASSOCIATIVE EXPANSION        (relation depth <= 1, similarity, "tell me about X")
      |
memory state IS an eligibility filter
dormant evidence is normally excluded; tracked edges must independently be active and applicable
```

Worked example. Scope tags `house`, `color`, `brittan`:

```text
brittans_hus.color = green            direct slot match
  (state; has no memory state at all) -> ALWAYS retrieved

"Brittan bought paint at Bauhaus"     1-hop associative evidence
  dormant, strength 0.08              -> NOT retrieved
```

Both are correct. That is dormancy doing its job in exactly one place.

### 8.2 Retrieval intents and surfaces

| Intent | Example question | Surface read |
| --- | --- | --- |
| `current_state` | "Vilken färg har Brittans hus?" | slot lookup in current state |
| `history` | "Vilka färger har huset haft?" | state history intervals |
| `event` | "Vem målade huset rött?" | event records |
| `attribution` | "Vad sa presentatören?" | utterance records |
| `associative` | "Berätta något om Brittan" | salience-weighted evidence + related state |

Rules:

- Intent classification is explicit, inspectable, and may return several
  intents.
- An ambiguous or missing intent defaults to `current_state` + `attribution`.
  It never defaults to `associative` alone.
- A `history` intent explicitly retrieves closed intervals. Closed intervals
  are unreachable under any other intent, and the model is never shown a past
  value without its interval.
- No intent may read state through the evidence lifecycle, and no intent may
  read evidence as if it were state.

### 8.3 Scoring

`retrieval_score` is a per-query, ephemeral number. It is never persisted, and
it is never written back to any record.

| Term | Direct match | Associative expansion |
| --- | --- | --- |
| slot / entity exactness | yes | yes |
| lexical, tag, domain, semantic similarity | yes | yes |
| source authority | yes | yes |
| claim certainty | yes | yes |
| **memory strength** | **no** | yes |

Memory strength as a term in direct-match scoring is how dormancy leaks back
into a truth question. It is prohibited.

---

## 9. Composition and controlled context

Retrieval and composition are different decisions:

```text
RETRIEVAL     decides WHAT enters the controlled context
COMPOSITION   decides WHERE it appears and in what order
```

### 9.1 The pipeline

```text
DEFINE     semantic scope (tags, domains, entities, slots)
  |
RETRIEVE   eligible state + evidence for the intent
  |
EXPAND     directly related context, max relation depth = 1
  |
FILTER     task applicability and budget
  |
GROUP      by severity, then by record type
  |
ORDER      by memory strength ASC within each group
  |
COMBINE    deterministic typed payload
```

`EXPAND` is graph depth, not similarity ranking. "One level" means one hop.
"Closest" would mean similarity; the two must not be conflated in naming or in
code.

### 9.2 Ordering

Ordering by strength ascending is deliberate: the weakest supporting material
appears first and the strongest material sits closest to the instruction and
the output contract. Strength is therefore a **composition signal**, not only
a retrieval signal.

State bindings have no strength (§7.1). They are placed last by rule, nearest
the instruction, ahead of every evidence record.

### 9.3 Payload contract

The controlled context is a typed payload with separated sections, so the
model can tell an accepted fact from an attributed claim without guessing:

```json
{
  "scope":        { "tags": [], "entities": [], "slots": [] },
  "state":        [],
  "history":      [],
  "events":       [],
  "utterances":   [],
  "claims":       [],
  "artifacts":    [],
  "provenance":   []
}
```

Rules:

- A flat list of sentences is not an acceptable payload. Section membership is
  itself information.
- Runtime ids, knowledge ids, lifecycle numbers, retrieval scores, selection
  evidence and audit records never appear in the payload.
- `history` entries always carry their interval. `claims` always carry
  attribution and status. `utterances` always carry speaker and speech act.
- The budget is measured on the exact serialized payload, and required
  material that does not fit is an explicit failure, never a silent omission.

---

## 10. Process contracts

Each process is normative. "Must not write" is as binding as "may write" — it
is where the previous model failed.

### 10.1 Write path

| | `INGEST` |
| --- | --- |
| Input | Artifact or message, verified runtime scope |
| Reads | Nothing in memory |
| May write | Artifact record, raw utterance record |
| Must not write | Claims, bindings, state, lifecycle strength |
| Output | Artifact id, utterance ids |
| Fails when | Scope unverified, budget exceeded |

| | `INTERPRET` |
| --- | --- |
| Input | Utterance or artifact content |
| Reads | Entity registry, slot registry |
| May write | Nothing. It proposes only. |
| Must not write | Anything |
| Output | Proposed entities, slots, bindings, events, claims, with per-item confidence and unresolved references |
| Fails when | Output is not structurally valid; an entity cannot be resolved (recorded as unresolved, not guessed) |

| | `RECONCILE` |
| --- | --- |
| Input | Proposed claim, the addressed slot, that slot's current binding and interval history |
| Reads | State, history, existing claims |
| May write | Nothing. It decides only. |
| Must not write | Anything |
| Output | One of: `re_assertion`, `change`, `correction`, `conflict`, `retraction`, `no_op` |
| Fails when | The proposal has no resolved slot; the decision is not one of the listed outcomes |

Note the shape change from the previous five-way relation set: `RECONCILE`
decides about a **slot**, never about a sentence, and "supersede" is not one of
its outcomes. A new value is a `change`, which is a state transition.

| | `ACCEPT` |
| --- | --- |
| Input | Claim, reconcile outcome, acceptance policy |
| Reads | Claim, source authority, competing claims |
| May write | `Claim.status` |
| Must not write | Bindings, history, lifecycle |
| Output | Accepted / rejected / contested, with the policy and reason recorded |
| Fails when | The policy is not identified; authority is unverified |

`ACCEPT` is the only place where "a source said it" can become "the system
holds it". Encoding acceptance inside an activation or trust heuristic is a
defect.

| | `UPDATE` |
| --- | --- |
| Input | Accepted claim with a reconcile outcome of `change` or `correction` |
| Reads | The slot's current binding |
| May write | Close one interval, open one interval, write one `StateTransition`, atomically |
| Must not write | Lifecycle strength, activation, retrieval indexes as part of the same decision |
| Output | The new binding and the transition record |
| Fails when | The slot is contested; cardinality would be violated; the write is not atomic |

`UPDATE` must never set a memory state on anything. Closing an interval is not
"making a memory dormant".

| | `ESTABLISH_ASSOCIATION` (L3 RelationIndex owner) |
| --- | --- |
| Input | Resolved canonical edge, runtime applicability scope, original-source semantic proof and occurrence identity |
| Reads | Captured and current endpoints, original utterance/locator, existing edge baseline and receipts |
| May write | Association metadata, occurrence/edge receipt and audit, atomically with the live knowledge commit |
| Must not write | Endpoints, claim status/confidence, bindings, state/history or world clocks |
| Output | Created / reinforced / duplicate, or an explicit skipped-edge diagnostic from runtime validation |
| Rule | Only independent source evidence writes; traversal/rendering never invokes this operation |

### 10.2 Read path

| | `DEFINE` |
| --- | --- |
| Input | Task, message, verified scope |
| Reads | Scope registry |
| May write | Nothing |
| Must not write | Anything |
| Output | Semantic scope: tags, domains, entities, candidate slots, retrieval intents |

| | `RETRIEVE` |
| --- | --- |
| Input | Scope and intents |
| Reads | State, history, evidence, indexes |
| May write | Nothing |
| Must not write | Anything, including reinforcement |
| Output | Eligible records with per-query scores and reasons |
| Rule | Direct matches ignore memory state entirely (L8) |

| | `EXPAND` |
| --- | --- |
| Input | Retrieved records |
| Reads | Relation graph, depth ≤ 1 |
| May write | Nothing |
| Output | Related records, marked as associative |
| Rule | Evaluate tracked edge activity/applicability and endpoint evidence separately; retain direct and alternate eligible routes; no strengthening |

| | `FILTER` |
| --- | --- |
| Input | Retrieved + expanded records, task applicability, budget |
| May write | Nothing |
| Output | The admitted set, plus an explicit exclusion reason per omitted record |

| | `COMPOSE` |
| --- | --- |
| Input | Admitted set |
| May write | Nothing |
| Output | Grouped by severity and type, ordered by strength ascending, state last |

| | `PROJECT` |
| --- | --- |
| Input | Composed set, exact budget |
| May write | Nothing |
| Must not write | Strength, activation, revision, audit-as-context |
| Output | The typed serialized payload of §9.3, plus separate evidence for diagnostics |
| Fails when | Required material does not fit the exact serialized budget |

`PROJECT` performing reinforcement is the single most consequential violation
of L11, because it makes every read a write and every answer a lifecycle event.

### 10.3 Lifecycle path

| Process | Authority and writes |
| --- | --- |
| Automatic `reinforceOccurrence` | Validated fresh supporting occurrence, exact claim and restatement/extend relation; decay first, then capped boost. Writes baseline/time, derived cache, real recurrence time, audit and durable receipt in one transaction. Never writes truth/state/history. |
| Explicit `reinforce` maintenance | Named caller/reason; operates on evaluated strength and rebases. Kept as a deliberate maintenance API, never invoked by reads or used instead of the automatic occurrence gate. |
| Explicit `weaken` / `decay` maintenance | Named caller/reason; subtracts an explicit amount or the retained legacy `decayRate * elapsed` amount from evaluated strength, then rebases. This preserves the manual API's units; it is not the automatic exponential calculation or a scheduled job. |
| Explicit `reactivate` maintenance | Explicit request only; may raise strength to the threshold and rebase. No read or diagnostic candidate authorizes it; maintenance is not a fresh recurrence. |


---

## 11. Acceptance scenarios

These are written before implementation and are the definition of done for the
model. Each `MUST NOT` is as binding as its `MUST`.

### S1 — Changing house colour

```text
GIVEN  T0  assertion: "Brittans hus är vitt"
       T1  event:     "Brittan målade huset rött"
       T2  assertion: "Nu är huset grönt"

THEN   state    brittans_hus.color = green
       history  white [T0,T1)  red [T1,T2)  green [T2,-)
       events   house_painted(brittan, red) @ T1

Q  "Vilken färg har Brittans hus?"        A  green
Q  (asked again)                          A  green
Q  "Vilka färger har huset haft?"         A  white, red, green (with intervals)
Q  "Vem målade huset rött?"               A  Brittan

MUST NOT  store four unrelated natural-language memories
MUST NOT  mark white or red as "superseded knowledge"
MUST NOT  let the answer to the first question depend on any strength value
```

### S2 — Correction versus change

```text
GIVEN  S1, and then: "Huset var aldrig vitt, jag minns fel"

THEN   the T0 interval is amended, not closed-and-reopened
       a correction record is retained, with who corrected it and when
       history no longer claims the house was white over [T0,T1)

MUST NOT  be represented as a fourth colour change
MUST NOT  silently delete the original assertion or its provenance
```

### S3 — Source code

```text
GIVEN  main.cpp contains  int main() { ... }

THEN   artifact       main.cpp (contentKind = source_code, language = C++)
       entity         main()
       relationship   main.cpp --contains--> main()
       attribute      main.return_type = int

Q  "Where is main defined?"     A  main.cpp
Q  "What does main return?"     A  int

MUST NOT  produce three unrelated natural-language memories
MUST NOT  require who / why dimensions on any of these records
```

### S4 — Attributed prediction

```text
GIVEN  Kanal 4 presenter: "It will probably rain tomorrow."

THEN   utterance  speaker = Kanal 4 presenter, act = prediction
       claim      rain(tomorrow), certainty = probable,
                  attributedTo = presenter, status = asserted

Q  "Vad sa presentatören?"      A  attributed utterance
Q  "Regnar det imorgon?"        A  a probabilistic claim, with its source

MUST NOT  create an accepted current-state binding about the weather
MUST NOT  answer as unqualified canonical truth
```

### S5 — Recitation

```text
GIVEN  "Fader vår som är i himmelen"

THEN   utterance  act = recitation, contentKind = prayer
       content    retained verbatim, recognized as a known recitation

MUST NOT  produce a claim that the speaker's father lives in heaven
MUST NOT  produce any accepted state binding
```

### S6 — Dormant direct hit

```text
GIVEN  brittans_hus.color = green is current state
       every supporting evidence record is dormant, strength 0.10

Q  "Vilken färg har Brittans hus?"     A  green

MUST  answer green regardless of every strength value
MUST NOT  exclude the slot because supporting evidence is dormant
MUST NOT  require reactivation before the answer can be produced
MAY   reactivate the supporting evidence after the answer is produced
```

### S7 — Associative recall respects dormancy

```text
GIVEN  scope tags: house, color, brittan
       brittans_hus.color = green                     direct match
       "Brittan bought paint at Bauhaus", dormant     1-hop associative

Q  "Berätta något om Brittan"

THEN   the state binding is included
       the dormant 1-hop evidence is excluded, with an explicit reason

MUST NOT  include every 1-hop neighbour merely because it is related
```

### S8 — Conflict

```text
GIVEN  Stefan: "Rickard owns a blue car"      @ overlapping interval
       Anna:   "Rickard's car is red"         @ overlapping interval
       both sources are acceptance-eligible

THEN   rickards_bil.color has NO accepted binding for that interval
       both claims are retained, status = contested

Q  "Vilken färg har Rickards bil?"
A  the system holds two conflicting accounts, with both attributions

MUST NOT  resolve by recency
MUST NOT  resolve by memory strength
MUST NOT  drop the losing claim
```

### S9 — Attribution without acceptance

```text
GIVEN  Stefan: "Rickard owns a blue car."

THEN   utterance      speaker = Stefan, act = assertion
       claims         rickard --owns--> car
                      rickards_bil.color = blue
       claim status   asserted

Q  "Vem sa att Rickard har en bil?"    A  Stefan
Q  "Äger Rickard en bil?"              A  Stefan asserts so; acceptance
                                          depends on the acceptance policy

MUST NOT  make CANONICAL TRUTH = TRUE an automatic consequence of the utterance
```

### S10 — Retraction

```text
GIVEN  an accepted claim that produced a current binding
WHEN   the source retracts it

THEN   claim status = retracted
       the binding it caused is re-evaluated by ACCEPT
       if no other accepted claim supports it, the interval is closed with a
       recorded cause of "retraction", not deleted

MUST NOT  leave an accepted binding with no surviving accepted claim (L12)
```

---

## 12. Storage: deliberately deferred

The original sequencing below is historical. L2 upgrades the implemented
knowledge store to schema 3 under ADR 0035 P4. One `BEGIN IMMEDIATE` transaction
converts all existing namespaces at one operational timestamp and changes the
version. Saved strength, threshold (including zero), pins, evidence and history
survive. Legacy severity stays null; legacy half-life is explicitly 90 days,
boost 0.2 and cap 1. Unknown world/recurrence times remain unknown. Corrupt data
fails the upgrade; a failed conversion rolls back and can be retried. Schema 3
also stores occurrence/claim receipts.

L3 advances to schema 4 under P6: new edge metadata, receipts and audit are added
in the same transaction as the version change. Existing schema-3 baselines are
validated and preserved without re-aging or policy conversion. Legacy links stay
untracked; no numeric metadata/proof is invented during migration. Older schema-1/2
stores retain the same accepted L2 conversion on their path to schema 4.
Unsupported versions and corrupt association records fail rather than being
silently dropped. Old binaries reject the new schema before they can write it.

Before opening a valuable existing store with the new build, stop A008 writers
and create a SQLite backup using SQLite's backup API (or an offline copy of the
entire database/WAL set). A lone copy of the main file while writers run is not
a complete backup. Keep the backup until upgrade verification is accepted. Also preserve the
global settings file before saving settings format 4 if a binary rollback may
be needed. Restore compatible settings together with the older binary. To
roll back, stop all writers, preserve the upgraded database/WAL set separately,
and restore the complete pre-upgrade backup to its original path before opening
it with the previous binary. Never combine an upgraded WAL with a restored
database. The L2 and L3 lifecycle fixtures execute backup, interrupted upgrade,
retry, previous published store rejection and restoration. The L3 fixture creates
its legacy database through the published L2 store implementation and verifies
both namespaces and unchanged evidence baselines. No user runtime database was
opened or migrated during A008-0081/A008-0082 verification.


No SQLite table, JSON shape, index, FTS configuration, embedding column, or
migration belongs in this document, and none should be designed until §1–§11
are accepted and §10 has passing acceptance tests against an in-memory
reference.

Designing storage first is what produced a single `KnowledgeItem` row carrying
identity, truth, lifecycle and trust at once.

Preconditions before storage design starts:

1. The ontology (§2) and slot addressing (§3) are accepted.
2. The clocks (§4) are accepted.
3. State/history/evidence are three distinct record families (§5, §6).
4. The process contracts (§10) exist as an in-memory reference implementation.
5. The acceptance scenarios (§11) pass against that reference.

Only then: intervals, indexes, FTS, embeddings, and the migration of existing
rows.

---

## 13. Appendix: schema sketch

Written last, on purpose. This is a sketch of the shape the model implies, not
an interface contract.

```ts
// ---- referential -------------------------------------------------------

interface Artifact {
  readonly id: ArtifactId;
  readonly contentKind: ContentKind;
  readonly locator: string;
  readonly ingestedAt: Instant;
}

interface Entity {
  readonly id: EntityId;
  readonly type: string;
  readonly labels: readonly string[];   // labels, never identity
}

// ---- addressing --------------------------------------------------------

type SlotRef =
  | { readonly kind: "attribute"; readonly entity: EntityId; readonly name: string }
  | { readonly kind: "relation";  readonly subject: EntityId; readonly name: string };

interface SlotDefinition {
  readonly ref: SlotRef;
  readonly cardinality: "single" | "set";
  readonly valueType: string;
}

// ---- time --------------------------------------------------------------

type Instant = string | { readonly unknown: true };

interface Interval {
  readonly from: Instant;
  readonly to: Instant | null;          // null = still holding
}

// ---- state -------------------------------------------------------------

interface AttributeBinding {
  readonly id: BindingId;
  readonly slot: SlotRef & { readonly kind: "attribute" };
  readonly value: unknown;
  readonly valid: Interval;
  readonly causedBy: TransitionId;
}

interface RelationshipBinding {
  readonly id: BindingId;
  readonly slot: SlotRef & { readonly kind: "relation" };
  readonly object: EntityId;
  readonly valid: Interval;
  readonly causedBy: TransitionId;
}

interface StateTransition {
  readonly id: TransitionId;
  readonly slot: SlotRef;
  readonly from: unknown | null;
  readonly to: unknown | null;
  readonly at: Instant;
  readonly reason: "change" | "correction" | "retraction";
  readonly causedBy: ClaimId | EventId;
  readonly decidedBy: string;           // acceptance policy identity
}

// ---- evidence ----------------------------------------------------------

interface Utterance {
  readonly id: UtteranceId;
  readonly speaker: EntityId | string;
  readonly act: SpeechAct;
  readonly contentKind: ContentKind;
  readonly content: string;
  readonly assertedAt: Instant;
  readonly artifact: ArtifactId | null;
}

interface Event {
  readonly id: EventId;
  readonly type: string;
  readonly dimensions: Partial<Record<"who" | "what" | "where" | "when" | "how" | "why", unknown>>;
  readonly eventTime: Instant;
  readonly proposedEffects: readonly ProposedTransition[];
}

interface Claim {
  readonly id: ClaimId;
  readonly proposition: ProposedTransition | EventOccurrence | Negation;
  readonly certainty: "certain" | "probable" | "possible" | "unlikely";
  readonly attributedTo: EntityId | string;
  readonly derivedFrom: UtteranceId | EventId | ArtifactId;
  readonly aboutInterval: Interval;
  readonly status: "asserted" | "accepted" | "contested" | "rejected" | "retracted";
}

interface Provenance {
  readonly of: RecordId;
  readonly derivedFrom: RecordId;
  readonly agent: string;
  readonly at: Instant;
}

// ---- lifecycle (evidence only) ----------------------------------------

interface MemoryLifecycle {
  readonly severity: "critical" | "important" | "minor" | null;
  readonly policyVersion: "exponential-v1" | "legacy-exponential-v1";
  readonly strengthUpdatedAt: string;
  readonly decayLambda: number;
  readonly boost: number;
  readonly maximum: 1;
  readonly creationOccurrenceId?: string;
  readonly state: "active" | "dormant";
  readonly strength: number;
  readonly decayRate: number;
  readonly threshold: number;
  readonly pinned: boolean;
  readonly lastReinforcedAt: Instant;
}

// Applied to evidence records, never to bindings or transitions.
type WithLifecycle<T> = T & { readonly lifecycle: MemoryLifecycle };
```

Note what is absent and must stay absent: no `canonicalStatus`, no
`supersededBy`, no `proposition` as identity, no `relevanceScore` on state, and
no lifecycle field on any binding.

---

## 14. Open questions

1. **Acceptance policy.** What makes a source acceptance-eligible? User
   assertion, authority threshold, corroboration count, or an explicit
   per-scope rule? Today this is implicit in a trust heuristic.
2. **Contested resolution.** Who resolves a contested slot, and through which
   surface? Never automatically — but "never" needs a path.
3. **Slot registry growth.** Are slots declared, or discovered on first use?
   Discovery is convenient and drifts; declaration is rigid and safe.
4. **Entity merge and split.** The reversal path for a wrong merge is not
   designed.
5. **Negation.** "Rickard does not own a car" as a first-class claim shape.
6. **Set-slot closure.** Does absence from a re-observation close a `set`
   member's interval, or does closure require an explicit removal claim?
7. **Resolved by L2 / ADR 0035:** automatic decay is lazy at an injected
   operation time. No background sweep is required.
8. **Severity.** §9 groups by severity; severity is not yet defined anywhere
   in the model.
