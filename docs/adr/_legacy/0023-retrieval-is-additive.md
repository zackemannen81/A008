# ADR 0023 — Retrieval is additive, not exclusive

Status: Accepted

Date: 2026-09-04

Decision owner: Operator

Amends: [ADR 0007](0007-sqlite-hybrid-memory-read-path.md) and
[ADR 0018](0018-knowledge-and-memory-model.md) at the point where a knowledge
projection becomes provider context.

## Context

The owner has stated the requirement more than once, in these words: everything
that matches should be sent along. The implementation did the opposite, and had
done since A008-0028.

`KnowledgeMemoryReader.payloadItems()` walked the projection like this:

```ts
push every state entry
if (items.length > 0) return items;   // claims and utterances discarded
push every claim
if (items.length > 0) return items;   // utterances discarded
push every utterance
```

Three consequences, in increasing order of severity.

**One surface silently suppressed the others.** A single current-state binding
was enough to discard every claim and every utterance the retrieval path had
already found, ranked and admitted. The live symptom was a question about the
agent's own name answered with a fact about a horse: the read had found both,
and the projection kept only the state entry.

**Four of seven surfaces were unreachable.** `ProjectionPayload` carries
`state`, `history`, `events`, `utterances`, `claims`, `artifacts` and
`provenance`. `payloadItems` read three. `history`, `events`, `artifacts` and
`provenance` could not reach a model under any circumstances — not as a
fallback, not at all.

**Nothing tested it.** `live-reader.ts` appeared in no test file. It is the
single function that decides what the model sees on every turn.

None of this was ever a decision. There is no ADR, no charter and no comment
anywhere saying state outranks claims. It is an early-return that someone wrote
for the first case that had data in it, and it became policy by sitting there.

## Decision

### D1. A surface may not suppress another surface

Every admitted record stays eligible for provider context regardless of which
surface it lives on. State, history, events, utterances, claims, artifacts and
provenance may coexist in one projection.

Stated as the rule an implementer has to break to get this wrong again:

> The presence of a record on one surface MUST NOT remove a record on another.

Ranking, deduplication and the budget may still drop individual records. They
may drop them for being lower-ranked, redundant, or too large to fit. They may
not drop them for being the wrong kind.

### D2. Ranking orders; it does not filter

`SURFACE_AUTHORITY` gives each surface a weight — state 1, claim 0.4, event
0.35, history 0.3, utterance 0.2, artifact 0.15, provenance 0.1. It sorts one
projection. It is not a truth score and it is not an eligibility test.

The three weights that already existed are unchanged, so the four surfaces this
ADR makes reachable slot in around them without reordering anything that
already worked.

Equal weights break ties by payload order, which is fixed. Two reads of an
unchanged store project the same items in the same order; a projection that
reordered between identical reads would make a bad answer impossible to
reproduce.

### D3. Deduplication is the one place a surface may lose

The same fact legitimately exists several times over: a binding, the claim that
established it, and the utterance the claim was extracted from all say it. Three
copies spend budget on one fact and read to a model as emphasis.

So identical propositions collapse to one, keeping the highest-ranked carrier.
This is the single exception to D1, and it is narrow on purpose: a surface loses
only when it adds no words the projection does not already have.

### D4. The budget is explicit, bounded, and reported

Going additive multiplies how much can reach one turn. Without a bound this ADR
would trade a silent omission for a silent overflow.

`DEFAULT_PROJECTION_BUDGET_BYTES` is 32768 bytes of serialized projection,
overridable per reader. Bytes rather than an item count, because bytes are what
the provider charges for and what one long utterance actually costs.

Two rules make it safe:

- Everything the budget cuts appears in `omittedKnowledgeIds`, alongside what
  the retrieval path filtered and what deduplication collapsed. Three different
  reasons to be missing, all three reported.
- A single item larger than the whole budget is still sent. An empty projection
  is not a smaller answer, it is no memory at all.

### D5. This is not the whole requirement

The owner's requirement also covers matching on domain and scope, so that
knowledge related to the current topic is retrieved even when it shares no tag
with the message. This ADR does not deliver that, and the reason is worth
recording because it is not a matter of effort.

**A008 does not store tags or domains on knowledge records.** The analyzer
extracts them per proposal, staging carries them, and the relation classifier
receives them — and then `live-commit.ts` writes a claim, an entity and a
binding, and the tags and domains are dropped. There are no columns for them in
`sqlite-schema.ts`.

Downstream of that, everything that looks like tag matching is inert:
`retrieve()` sets `record.tags = [...scope.tags]`, so a record's tags are a copy
of the query's; `filter()` then compares the query's tags against the query's
own tags and admits everything. The planner's `matchTaxonomy` matches against a
`knownTags`/`knownDomains` vocabulary that is never supplied, so `plan.tags` and
`plan.domains` are always empty. `live-reader` passes the constant
`["local"]` as tags and never passes domains at all.

The single retrieval signal that varies with the message today is the entity
list. That is why polluted entity labels were catastrophic rather than merely
untidy.

Making domain and scope real is a storage change, a write-path change and a
schema migration. It is its own task and its own ADR.

## Consequences

- More reaches the model per turn, which is the point, and it is bounded and
  reported rather than unbounded.
- Two existing tests asserted exactly one selected item and were rewritten. They
  had codified the exclusive rule without naming it, and would otherwise have
  gone on passing against behaviour nobody chose.
- `live-reader.ts` has tests for the first time, including a fixture that
  reproduces the live failure rather than a tidied version of it.
- The four surfaces this makes reachable have never been sent to a model before.
  Their usefulness is now observable instead of theoretical.
