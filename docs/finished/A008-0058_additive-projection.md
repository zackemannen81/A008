# Task A008-0058 — Additive knowledge projection

Status: Complete
Owner: Operator
Parent: ADR 0023
Created: 2026-09-04
Completed: 2026-09-04
Branch: `claude/A008-0058-additive-projection`

## Why

The owner reported that a question about the agent's own name came back carrying
only an unrelated fact about a horse, and stated the requirement that had been
stated before: everything that matches should be sent along.

The requirement was not met, and had not been since A008-0028.

## What was actually wrong

`KnowledgeMemoryReader.payloadItems()` chose one surface globally:

```ts
push every state entry
if (items.length > 0) return items;   // claims and utterances discarded
push every claim
if (items.length > 0) return items;   // utterances discarded
push every utterance
```

The retrieval path had already found, ranked and admitted both records in the
reported failure. The projection then kept the state binding and threw the
utterance away — not because of relevance, but because state had been reached
first.

Worse, and not in the original report: `ProjectionPayload` carries seven
surfaces and `payloadItems` read three. `history`, `events`, `artifacts` and
`provenance` could not reach a model under any circumstances.

## Why nobody noticed

`live-reader.ts` appeared in no test file. It is the one function that decides
what the model sees on every turn, and nothing exercised it. `project()` builds
all seven surfaces correctly and is tested; the loss happened one step later, in
the untested step.

There is also no decision behind it. No ADR, charter or comment says state
outranks claims. It arrived in `030def6` as an early-return someone wrote for
the first case that had data, and became policy by sitting there for ten tasks.

## What changed

`src/memory/knowledge/projection-items.ts` is new and owns the rule. All seven
surfaces are collected, deduplicated, ranked and budgeted. `live-reader.ts`
calls it and reports what it dropped.

The four decisions are ADR 0023 D1–D4. The two worth repeating here:

**Deduplication is the single exception to additivity.** The same fact really
does exist as a binding, a claim and an utterance at once; three copies spend
budget on one fact. Identical propositions collapse to the highest-ranked
carrier, and a surface loses only when it adds no words the projection does not
already have.

**A budget was required, not optional.** Going additive multiplies what reaches
one turn, and shipping this without a bound would have traded a silent omission
for a silent overflow. 32768 bytes of serialized projection by default, with
everything it cuts named in `omittedKnowledgeIds` and a single oversized item
still sent — an empty projection is not a smaller answer, it is no memory.

## The fixture reproduces the failure, not a tidy version of it

The first attempt at a regression test built the horse entity with clean labels
— `["Zorros häst", "Fresca"]` — and the state binding was never retrieved at
all. The test passed for the wrong reason, and that was informative: with honest
labels the two records never collide, so there is nothing for the projection to
suppress.

The live store does not have honest labels. `live-commit.ts` writes
`uniqueLabels([label, proposition, ...entities, ...tokenize(proposition)])`, and
`tokenize` keeps every word of four characters or more, so `heter` is an alias
of the horse and `"Vad heter du?"` matches it.

The fixture now uses exactly those labels. It reproduces the reported failure
end to end, including the `scope: ["heter"]` visible in the owner's screenshot.
That defect is A008-0059's; it is preserved here deliberately, because it is
what puts two surfaces in one read, and a gate armed with a case that cannot
fire proves nothing.

## Verification

`npm test`: 370 core, 4 membership, 75 GUI, 0 fail, 0 skipped, up from 356.
Fourteen new cases in `test/knowledge-projection.test.ts`, the first tests
`live-reader.ts` has ever had.

Thirteen mutations, each applied alone and reverted. All thirteen were caught.
The headline one restores the original bug — state short-circuits the rest — and
fails seven cases, led by the regression test. Removing ranking fails five;
removing the budget, the oversized-item rule, deduplication, the relation in a
provenance item, blank-proposition filtering, the stable tiebreak, and both
reporting fields each fail the case that names them.

## Two existing tests were rewritten rather than left passing

`local-memory-runtime.test.ts` asserted `selectedKnowledgeIds.length === 1`
twice. That had codified the exclusive rule without naming it, and would have
gone on passing against behaviour nobody chose.

Both now assert the real contract, and are stronger for it: two items, the
extracted proposition ranked first as `state`, and the sentence the user
actually said it in following as `utterance`. The old assertion could not tell
the difference between "one surface won" and "one record matched".

## What this does not do

The owner's requirement also covers matching on domain and scope, so related
knowledge is retrieved even when it shares no tag with the message. That is not
delivered here, and ADR 0023 D5 records why it cannot be: **A008 does not store
tags or domains on knowledge records at all.**

The analyzer extracts them, staging carries them, the classifier reads them —
and `live-commit.ts` then writes a claim, an entity and a binding, and drops
them. `sqlite-schema.ts` has no column for either.

Everything downstream that looks like tag matching is therefore inert.
`retrieve()` sets `record.tags = [...scope.tags]`, so `filter()` compares the
query's tags with a copy of the query's tags and admits everything. The
planner's `matchTaxonomy` matches against a vocabulary that is never supplied.
`live-reader` passes the constant `["local"]` and no domains.

One thing found while establishing that, worth the next task's attention:
`SqliteMemoryRepository` — the other repository, used by `HybridMemoryReader` —
already has FTS5 over tags and scopes plus indexed entities and domains.
A008-0028 cut the runtime over to the knowledge path and left that machinery
behind. The capability may not need building from nothing.
