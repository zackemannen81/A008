# Retrieval scope: classified domains and an accumulating current_scope

Status: Built by A008-0063 (ADR 0024)
Source: owner design, 2026-09-05
Recorded: 2026-09-05

## Why this document exists

The owner has stated the retrieval requirement several times and the
implementation has not matched it. This records the mechanism precisely enough
that a later reader cannot arrive at a different one, before any of it is built.

It is the owner's design. The open questions at the end are mine.

## The loop

```text
user message
  ↓
classify → domains, related_domains, tags, related_tags     [provider call]
  ↓
update current_scope
  ↓
retrieve every record matching any of them
  ↓
payload = context + message
  ↓
answer                                                       [provider call]
  ↓
extract knowledge, tags, domains from the answer             [provider call]
  ↓
store
```

## What current_scope is

**An accumulating set of domains representing the subject area of the ongoing
discussion.** Not a label a model invents, and not a name for the conversation.

It holds **domains only** — never tags. The owner's reason is worth quoting in
substance: tags are fine-grained, and letting them accumulate into the
discussion-level signal would repeat the `heter` failure one level up, where a
common word becomes a match for everything.

## The rule

For each user message:

```text
1. classify the message into  domains  and  related_domains
2. candidate_scope = domains ∪ related_domains

3. if current_scope is empty:
       current_scope = candidate_scope

4. else if candidate_scope ∩ current_scope is empty:
       # topic change
       current_scope = candidate_scope

   else:
       # same or neighbouring discussion
       current_scope = current_scope ∪ candidate_scope
```

A **related** domain overlapping is enough to keep the discussion in scope. The
primary domain does not have to match. The owner is explicit about this:

> current_scope: Neuroscience, Cognitive Science
> new: domains = Learning Science; related = Cognitive Science, Education

`Learning Science` is not in scope, but `Cognitive Science` is, so this is the
same discussion and the scope widens to include Learning Science and Education.

Compact form:

> `current_scope` is the accumulated union of primary and related domains for
> the current discussion. On each message, classify primary and related domains.
> If none of the newly classified domains overlap the existing `current_scope`,
> start a new scope. If any overlap exists, preserve the existing scope and add
> all newly classified primary and related domains to it.

## The matching rule

A stored record is retrieved if **any** of these hold:

```text
tag    ∈ query.tags
tag    ∈ query.related_tags
domain ∈ query.domains
domain ∈ query.related_domains
domain ∈ current_scope
```

Two levels, doing different jobs:

| Level | Signal | Job |
| --- | --- | --- |
| this message | tags, related tags, domains, related domains | direct relevance |
| the discussion | current_scope | continuity across turns |

The second is what lets a record about the hippocampus come back ten turns later
for *"and what happens when we sleep after learning something?"*, even though
that turn's tags never mention it. The record carries `domain = Neuroscience`,
and Neuroscience is still in `current_scope`.

This is the point of the whole mechanism: topic continuity without carrying
fifty old chat messages in the prompt.

## What A008 had when this was written

Nothing of it, and the reason was not effort. Recorded in ADR 0023 D5 and kept
here because it is what the Outcome below was built against:

- The analyzer already extracts `tags` and `domains` per proposal. Staging
  carries them. The relation classifier reads them. `live-commit.ts` then writes
  a claim, an entity and a binding, and **drops both**.
- `sqlite-schema.ts` has no column for either.
- `retrieve()` sets `record.tags = [...scope.tags]`, so a record's tags are a
  copy of the query's, and `filter()` compares the query with itself.
- There is no classification call before the read at all.

## Open questions

These are mine, not the owner's, and each one is a place where the mechanism as
specified will behave differently from what the specification implies.

### 1. Gradual drift never resets the scope

The reset only fires on an *empty* intersection. A conversation that moves one
step at a time — memory → sleep → circadian rhythm → endocrinology → chemistry →
materials → engineering — overlaps at every consecutive pair, so it never
resets. After forty turns `current_scope` holds forty domains and matches
essentially the whole store.

That is a silent degradation: excellent for five turns, quietly useless at
fifty, and it looks like retrieval got worse rather than like a rule doing what
it was told.

The smallest fix that preserves the owner's semantics exactly for short
discussions is a bounded set with recency — cap it, and evict the domain least
recently reinforced by a classification. Short conversations behave identically;
long ones stop growing without a hard topic change.

### 2. Set membership is string equality, and the strings come from a model

`Cognitive Science`, `cognitive science` and `Cognitive science` are three
different members. A spelling difference between two turns produces an empty
intersection and therefore a spurious topic change, discarding the accumulated
scope.

Normalisation — trim, casefold, collapse internal whitespace — is not optional
here; it is what makes the intersection mean what it reads as.

### 3. The two calls must share one vocabulary

Observed in the owner's own trace: the retrieval classification answered in
English (`Psychology`, `Cognitive Science`) and the extraction answered in
Swedish (`kognitivvetenskap`, `neurologi`). Those sets never intersect, and no
normalisation closes it.

The fix is to seed the retrieval classification with the domains and tags the
store actually holds, so the model selects from existing labels and may extend
them, rather than inventing a parallel taxonomy in whichever language the
question happened to use.

### 4. Where current_scope lives

It is conversation state, not turn state. In-session is the obvious first
answer and matches how `ChatSession` already works, but it means a restart
starts a fresh scope. For a memory system that is a slightly awkward place to
land; persisting it per conversation is a small addition and worth deciding
deliberately rather than by default.

### 5. Cost

This adds one provider call per user message, before the answer. A turn goes
from 1 analyzer + N classifiers + 1 chat to 1 scope + 1 chat + 1 analyzer + N
classifiers.

## Suggested verification

The owner's own worked example is the test: four messages where the first three
widen one scope and the fourth — a question about a Porsche engine — has an
empty intersection and replaces it. Then a fifth message whose tags mention
nothing about the hippocampus, retrieving a hippocampus record because
`Neuroscience` is still in scope.

## Outcome

A008-0063 built it, and ADR 0024 is the decision record. The five open questions
above were answered as follows.

1. **Gradual drift** — a ceiling of 32 domains with least-recently-reinforced
   eviction, recorded in ADR 0024 D5 as an addition to the owner's rule rather
   than part of it. Below the ceiling the specified behaviour is unchanged.
2. **Normalisation** — trim, collapse whitespace, casefold, applied on both
   sides of every comparison, sharing `normalizeLabel` with the label store so
   the two can never drift apart.
3. **Shared vocabulary** — the classifier is handed the store's own domains and
   tags and asked to prefer them and to answer in their language. This is what
   closes the English/Swedish mismatch in the owner's trace.
4. **Where it lives** — in-session, per conversation. Called out in ADR 0024's
   consequences rather than left to be discovered; persisting it is its own
   decision.
5. **Cost** — one provider call per user message, stated in ADR 0024 D1.
