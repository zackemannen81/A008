# Task A008-0063 — Retrieval scope classification and current_scope

Status: Complete
Owner: Operator
Parent: ADR 0024
Created: 2026-09-05
Completed: 2026-09-05
Branch: `claude/A008-0063-retrieval-scope`

## Why

The last piece of the owner's loop. A008-0060 made tags and domains real —
extracted, stored, indexed, matched — but matching was lexical: a label had to
appear literally in the question. So *"hur fungerar människans minne?"* found
nothing filed under neuroscience, because the question does not contain the
word.

The owner specified the mechanism precisely and it is recorded in
`docs/backlog/current-scope-retrieval.md`. This builds it.

## What it does, shown rather than described

The owner's own worked sequence, run against a store holding two neuroscience
records and one about a Porsche:

```text
Q: Hur fungerar människans minne?
   → Hippocampus… | Amygdala…          the question names no domain at all

Q: Vad gör hippocampus?
   → Hippocampus… | Amygdala…

Q: Hur påverkar sömn konsolideringen?
   → Hippocampus… | Amygdala…          scope widened with sleep science

Q: Och vad händer när vi sover efter att vi lärt oss något?
   → Hippocampus… | Amygdala…          ← the payoff

Q: Vilken motor sitter i en Porsche 911 GT3?
   → Porsche 911 GT3…                  empty intersection: scope replaced
```

The fourth is the one worth reading twice. It classifies as sleep science and
cognitive science — **neither of which is on the stored records** — and the
hippocampus record comes back anyway, because neuroscience is still in the
accumulated scope from three turns earlier. That is topic continuity without
carrying old messages in the prompt, which is the whole point of the mechanism.

The fifth proves the reset is real: the Porsche question shares no domain with
the discussion, so the scope is replaced and the neuroscience records go.

## The three things that were not obvious

**The related halves are the mechanism.** A classifier returning only the
domains a message contains adds nothing a substring search could not do. The
`relatedDomains` and `relatedTags` are the labels the message does *not* name,
and they are what makes the call worth a provider round trip.

**The two semantic calls have to share one taxonomy.** In the owner's trace the
retrieval step answered in English and the extraction step in Swedish, and those
sets never intersect however they are normalised. The prompt now carries the
store's own `knownDomains` and `knownTags` and asks the model to prefer them and
to answer in their language. A new subject can still be named.

**A related domain overlapping is enough.** The primary domain does not have to
match, which is what lets a message classified as Learning Science continue a
Neuroscience discussion through Cognitive Science. The owner is explicit about
this and it is easy to implement the stricter, wrong version by accident.

## The ceiling is mine

Not in the specification, added deliberately, recorded in ADR 0024 D5 so it can
be removed if the owner disagrees.

The reset fires only on an empty intersection, so a discussion that moves one
step at a time — memory, sleep, circadian rhythm, endocrinology, chemistry,
materials, engineering — overlaps at every consecutive pair and never resets.
After forty turns the scope holds forty domains and matches essentially the
whole store: excellent for five turns, quietly useless at fifty, and it looks
like retrieval got worse rather than like a rule doing what it was told.

32 domains, least-recently-reinforced eviction, and whatever it drops reported.
Below the ceiling the owner's rule applies unchanged.

## Verification

`npm test`: 426 core, 4 membership, 75 GUI, 0 fail, 0 skipped, up from 404.
Twenty-three new cases.

Fourteen mutations, each applied alone, all fourteen caught. Three survived a
first round and all three were real gaps:

- **Conversation isolation was untested.** Checking that two conversations store
  different scopes is not enough — a reader consulting every conversation would
  still write them back separately and look correct. The leak only shows when
  the other scope changes this one's *outcome*, so the case now shares a domain
  between them and asserts nothing else is inherited.
- **This turn's own domains reaching the query was covered for by the scope.**
  The accumulated scope subsumes the classification in every ordinary case; the
  one case it does not is a classification larger than the ceiling, where part
  of the candidate is evicted on arrival. Both the primary and the related list
  are now proved to reach the query on their own.
- **The vocabulary was never asserted to reach the model.** The reader tests use
  a fake classifier, so `ModelBackedRetrievalScopeClassifier` itself — the class
  that closes the language mismatch — had no test at all.

## What this does not do

`current_scope` is in-session and per conversation. A restart starts a fresh
scope, which for a memory system is an awkward place to land; persisting it is a
small addition and deliberately not made here, because where conversation state
belongs is a decision of its own.

Every turn now costs one more provider call.

The lexical path stays and stays tested. It is what every credential-free
surface and every offline test runs on, and it is also the fallback when the
classifier fails — because a scope failure must narrow a read, never fail a
turn.
