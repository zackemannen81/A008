# Task A008-0059 — Accept the confidence models actually emit

Status: Complete
Owner: Operator
Parent: None
Created: 2026-09-05
Completed: 2026-09-05
Branch: `claude/A008-0059-confidence-words`

## Why

The owner walked the intended retrieve/extract loop by hand and pasted a real
analyzer output: twenty-seven proposals, every one of them carrying
`"confidence": "high"`.

A008 would have stored none of them.

## The defect

`POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION` names `confidence` as a permitted
field and never says it must be a number. The parser did:

```ts
const confidence =
  raw.confidence === undefined ? 0.5
  : unit(typeof raw.confidence === "number" ? raw.confidence : Number.NaN, …);
```

Anything not a number became `NaN`, and `unit()` threw `invalid_input`.
A008-0050's per-item resilience then caught that and skipped the proposal, which
is correct behaviour for a bad item and exactly wrong here: the item was fine.
A008 had read the proposition, the kind, the tags, the domains and the entities
correctly, and threw all of it away over a metadata field.

Reproduced before fixing, with two proposals differing only in that field:

```
accepted: 1
skipped : 1
  -> "proposal 1 confidence must be a finite number between 0 and 1"
```

An extraction where every item says `"high"` — which is what a model asked for
confidence usually writes — stored nothing at all, and reported it as a skip
rather than a failure.

## What changed

`parseProposalConfidence` reads what the model wrote:

- a number stays a number, still bounded to 0–1;
- an ordinal word is looked up — certain 1, very high 0.95, high 0.85, likely
  0.75, medium/moderate/med 0.6, low 0.3, very low/uncertain 0.15;
- a numeric string is read as the number it plainly is, because quoting a number
  is a formatting slip and not a different claim.

Case, surrounding space and `_`/`-` separators are normalised, so `very_high`
and `  Very High  ` both land on 0.95.

Anything else is still refused, by name, listing the vocabulary. Leniency has to
stop somewhere or an unreadable value becomes a guess.

## The judgement in it

Turning a word into a number is lossy, and the exact values are a judgement
rather than a measurement. That is worth saying plainly rather than hiding
behind a table.

It is a much smaller loss than the alternative, which was not a more precise
number — it was silence. A proposition A008 read correctly, with its tags and
domains intact, discarded because the model wrote a word where the parser wanted
a float.

## Verification

`npm test`: 373 core, 4 membership, 75 GUI, 0 fail, 0 skipped.

Three new cases: the vocabulary and its normalisation, the refusals that must
survive the leniency, and a staging run proving a word-confidence proposal is
now staged rather than skipped.

Seven mutations, each alone. Six were caught by the case that names them —
dropping the words, dropping numeric strings, restoring case sensitivity,
allowing unknown words through at 0.5, allowing out-of-range numbers, and
collapsing high onto low. The seventh could not be compiled: disabling the
string branch narrows the type so the body is unreachable, and `tsc` refused it.

## What this does not do, and what the owner should decide

**The instruction still does not say what `confidence` is.** The parser is now
robust to the drift, which is the right place for robustness — a model will
write words whatever the prompt says. But the prompt could also stop inviting
the ambiguity, with a line such as:

> `confidence` is a number between 0 and 1.

`POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION` is owner-authored (A008-0047) and
is not edited here. That is a one-line change for the owner to make or decline.

**A second mismatch is not addressed and is not a parser problem.** In the
owner's trace the retrieval step returned domains and tags in English —
`"Psychology"`, `"Cognitive Science"` — while the extraction step returned them
in Swedish — `"kognitivvetenskap"`, `"neurologi"`. Literal matching between
those two sets finds nothing.

That cannot be fixed by normalising strings, and forcing one language in the
owner's instruction would be a change to their text. The design that avoids it
entirely is to give the retrieval-scope call the vocabulary the store actually
holds, so the model selects from existing labels and may extend them, rather
than inventing a parallel taxonomy in whatever language the question happened to
be asked in. That belongs to the task that builds the retrieval-scope call.
