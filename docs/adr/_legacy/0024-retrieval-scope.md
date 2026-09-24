# ADR 0024 — Retrieval scope: classified domains and an accumulating current_scope

Status: Accepted

Date: 2026-09-05

Decision owner: Operator

Amends: [ADR 0023](0023-retrieval-is-additive.md) D5, which recorded that domain
and scope matching could not be built because nothing was stored. A008-0060
stored it; this builds the rest.

## Context

The owner specified the mechanism precisely, twice, and the second time in full.
It is recorded verbatim in substance in
[`../backlog/current-scope-retrieval.md`](../backlog/current-scope-retrieval.md).

A008-0060 made tags and domains real: extracted, stored, indexed and matched.
What it could not do was reach a domain the message does not name. Matching was
lexical — a label had to appear literally in the question — so *"hur fungerar
människans minne?"* found nothing filed under neuroscience, because the question
does not contain the word.

That is the gap this closes.

## Decision

### D1. One provider call places the message before anything is read

`RetrievalScopeClassifier` classifies a user message into `domains`,
`relatedDomains`, `tags` and `relatedTags`. The **related** halves are the
point: they are the labels the message does not contain, and without them the
call adds nothing a substring search could not do.

It runs before retrieval and costs one call per user message. A turn goes from
1 analyzer + N classifiers + 1 chat to 1 scope + 1 chat + 1 analyzer + N
classifiers.

It uses the default model rather than whichever `/model` selected, for the same
reason `SEMANTIC_JSON_GENERATION` pins temperature to zero: this is A008's own
classification step and its behaviour should not change when the operator
switches the model they are talking to.

### D2. The classifier is offered the vocabulary the store holds

Observed in the owner's own trace: the retrieval step answered in English —
`Psychology`, `Cognitive Science` — and the extraction step in Swedish —
`kognitivvetenskap`, `neurologi`. Those two sets never intersect, and no amount
of normalisation closes it.

So the prompt carries `knownDomains` and `knownTags` from the store, and asks
the model to prefer a known label whenever one fits and to answer in the
vocabulary's language rather than the message's. A genuinely new subject can
still be named.

The vocabulary is bounded, because it grows without limit and this is a prompt,
not a database dump.

### D3. current_scope accumulates domains, and only domains

```text
candidate = domains ∪ relatedDomains
current empty            → current = candidate            (started)
candidate ∩ current = ∅  → current = candidate            (replaced: new topic)
otherwise                → current = current ∪ candidate  (widened)
```

A **related** domain overlapping is enough to hold the discussion in scope; the
primary domain does not have to match. That is what makes the mechanism work: a
message classified primarily as Learning Science continues a Neuroscience
discussion when Cognitive Science is among its related domains.

**Domains only, never tags.** The owner's reason is the one to keep: tags are
fine-grained, and accumulating them into the discussion-level signal would
repeat the `heter` failure one level up, where a single common label becomes a
match for everything in the store.

An empty classification changes nothing. Silence is not a new topic, and
treating it as an empty intersection would reset the discussion on every
message the classifier could not place.

Set membership is normalised on both sides. `Cognitive Science` and `cognitive
science` are one subject area written twice; unnormalised they never intersect,
and a missed intersection does not read as a bug — it reads as a change of
subject that silently discards the accumulated scope.

### D4. A record matches on any of the five

```text
tag    ∈ query.tags
tag    ∈ query.relatedTags
domain ∈ query.domains
domain ∈ query.relatedDomains
domain ∈ current_scope
```

Two levels doing different jobs: this message's labels give direct relevance,
and `current_scope` gives continuity across turns. The second is what lets a
record about the hippocampus come back for *"and what happens when we sleep
after learning something?"*, where that turn's own classification names sleep
science and cognitive science and nothing about the hippocampus at all.

### D5. The ceiling is mine, not the owner's

Not in the specification, added deliberately, and recorded here so it can be
removed if the owner disagrees.

The reset fires only on an **empty** intersection. A discussion that moves one
step at a time — memory, sleep, circadian rhythm, endocrinology, chemistry,
materials, engineering — overlaps at every consecutive pair and never resets.
After forty turns the scope holds forty domains and matches essentially the
whole store.

That is a silent degradation: excellent for five turns, quietly useless at
fifty, and it looks like retrieval got worse rather than like a rule doing what
it was told. This project keeps finding that failure mode and it is worth
refusing on sight.

`DEFAULT_MAXIMUM_SCOPE_DOMAINS` is 32, generous on purpose: below it the owner's
rule applies unchanged, so a normal discussion behaves exactly as specified, and
it only bites where the scope has already stopped discriminating. Eviction is
least-recently-reinforced — a domain the discussion returns to moves to the end
and survives — and whatever it drops is reported.

### D6. A scope failure narrows the read; it never fails the turn

Classification improves what can be found. It is not a precondition for
answering, and turning a provider hiccup into a dead conversation would be a
worse bug than the narrower retrieval it avoids. On failure, and when no
classifier is composed, the reader falls back to lexical matching against the
store's vocabulary.

The draft is untrusted model output. A non-array, a nested object, a number in
the middle of a list — all dropped rather than allowed to reach a store query.

## Consequences

- Retrieval finally does what the owner asked for: a record is found by what it
  is about, not by which of its words the question happened to repeat.
- Every turn costs one more provider call.
- `current_scope` is in-session only. A restart starts a fresh scope, which for
  a memory system is a slightly awkward place to land; persisting it is a small
  addition and deliberately not made here, because where conversation state
  belongs is a decision of its own.
- The lexical path stays, and stays tested. It is what every credential-free
  surface and every offline test runs on.
