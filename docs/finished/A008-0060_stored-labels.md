# Task A008-0060 — Stored tags and domains

Status: Complete
Owner: Operator
Parent: [`docs/backlog/current-scope-retrieval.md`](../backlog/current-scope-retrieval.md)
Created: 2026-09-05
Completed: 2026-09-05
Branch: `claude/A008-0060-stored-labels`

## Why

ADR 0023 D5 recorded the finding that stopped the previous task: A008 does not
store tags or domains on knowledge records. The analyzer extracts them, staging
carries them, the relation classifier reads them, and then `live-commit` writes
a claim, an entity and a binding and drops both. `sqlite-schema.ts` had no
column for either.

Everything downstream that looked like tag matching was therefore inert.

## What was broken, in order

Five failures in series, each of which made the next one invisible.

1. **Nothing was stored.** No column, no field, no attach.
2. **`retrieve()` echoed the query.** Every record builder wrote
   `tags: [...scope.tags]`, so a record's tags were whatever had been asked for.
3. **`filter()` compared the query with itself.** Given (2), the intersection
   was never empty, so the gate admitted everything while appearing to filter.
4. **The planner had no vocabulary.** `matchTaxonomy` matches a message against
   `knownTags`/`knownDomains`, which no live composition supplies, so
   `plan.tags` and `plan.domains` were always empty.
5. **`live-reader` passed a constant.** `tags: request.applicabilityScopes` is
   `["local"]` on every turn, and domains were never passed at all.

The only retrieval signal that varied with the message was the entity list.
That is the whole reason polluted entity labels were catastrophic rather than
untidy, and it is why removing that pollution had to wait for this task.

## What changed

**Labels are stored beside the record, not inside it.** `KnowledgeLabelStore`
follows the shape `EvidenceLifecycleStore` already uses for strength and state.
A label set is not part of what a claim asserts — it is how the claim is found —
and keeping it separate means neither `Claim` nor `Utterance` grows a field the
other does not use.

**One normalisation, applied on both sides of every comparison.**
`Cognitive Science`, `cognitive science` and `Cognitive  Science` are one
subject area written three ways, and an intersection that misses on a capital
letter would later read as a topic change rather than as a bug.

**`attach` merges rather than replaces.** A claim reinforced by a second
utterance keeps what it could already be found by; replacing would silently
narrow it whenever a later extraction phrased the subject differently.

**A label retrieval channel.** This is the capability, not a refactor: a record
becomes reachable because it is *about* the subject, even when the message names
none of its entities and shares none of its words. It is deliberately not gated
on retrieval intent — a subject-area match is orthogonal to whether the question
is about current state, history or attribution, and gating it would disable the
broader signal for exactly the open-ended questions it exists to serve.

**Bindings are reachable through it too.** A binding carries no labels of its
own — it is reached through a slot, which is reached through an entity — so
without this a subject-area match would return the claim while the current truth
it established stayed hidden. This was found by a failing test, not by
inspection: removing `tokenize` made the state binding unreachable and the
two-turn runtime test started returning a `claim` where it expected `state`.

**Both filter gates were corrected.** `labelsApply` matches on either axis, and
treats unlabelled as unlabelled rather than as unmatched. `taskApplies` now lets
a label match through: it requires an associative record to mention one of the
message's entities, which is right for a relation hop and exactly wrong for a
subject-area hit, since that is by definition a record the message does not
name. Two gates in series, each reasonable alone, is how the projection came to
discard everything but state.

**`tokenize(proposition)` is gone from `Entity.labels`.** It kept every word of
four characters or more, so `heter` was an alias of "Zorros häst heter Fresca"
and `"Vad heter du?"` matched it.

## The migration

Schema 2 adds two tables and changes nothing else. `INSERT OR IGNORE` leaves an
existing file stamped 1, so a bare version bump would have made
`assertSchemaVersion` refuse to open a store that is in fact perfectly readable
— turning an additive change into a lost memory file.

`migrateSchemaVersion` handles 1 → 2 and leaves anything else, including a
version from the future, for the check to refuse by name. A test creates a
version 1 database with the label tables dropped, opens it, and asserts it is
migrated and usable.

## What this does not do

The semantic half. The owner's design classifies a message into domains and
**related** domains — subject areas the message does not contain — and
accumulates them into a `current_scope`. That is a provider call and is
[`current-scope-retrieval.md`](../backlog/current-scope-retrieval.md).

What is built here is the lexical half: the message is matched against the
labels the store actually holds. `neurologi` in the question finds every
neurology record; `hur fungerar människans minne?` does not, because the word is
absent. `vocabulary()` exists so the classifier that closes that gap can be
seeded with the labels that exist, which is also what stops the two calls
inventing taxonomies in different languages.

`channelCounts.tag` and `channelCounts.domain` were hardcoded to zero because
nothing could ever set them. They count now.

## Verification

`npm test`: 391 core, 4 membership, 75 GUI, 0 fail, 0 skipped, up from 373.
Eighteen new cases.

End to end against a store holding three labelled facts:

```text
Q: Vad säger neurologi om det här?     tag 0  domain 2  → hippocampus + sömn
Q: Berätta om sömn.                    tag 1  domain 0  → sömn
Q: Vad vet du om fordonsteknik?        tag 0  domain 1  → Porsche
Q: Vad är huvudstaden i Frankrike?     tag 0  domain 0  → nothing
```

The first is the one that matters: the hippocampus record shares no word with
the question except the domain name.

Sixteen mutations, each applied alone. Fifteen were caught by the case that
names them and one could not be compiled.

Four of them survived the first round, and all four were real gaps in the tests
rather than false alarms:

- the `taskApplies` escape only fires when the message has entities, and no case
  had both entities and a label match;
- the unlabelled escape only fires for an associative record, and the case used
  one found directly, which short-circuits the gate;
- the minimum label length had no case at all;
- and removing the utterance attach changed nothing, because every case found
  the claim instead.

Each got a case. The third and fourth are worth keeping in mind: a two-character
label would match a substring of half the words in a sentence, and an ingested
source may have no accepted claim at all, so its utterance is the only record
there is.

## One thing found and deliberately not changed

`taskApplies` drops an expanded record whose text names none of the message's
entities, including a record reached over a relation hop that has already
justified itself. That is pre-existing behaviour, it is arguably a third gate
too many, and changing it is not this task. The test that touches it asserts on
the omission *reason* rather than on admission, so it isolates the gate it is
about and does not quietly depend on the other one.
