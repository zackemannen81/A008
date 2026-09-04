# Document ingest granularity

Status: Open — and now due
Source: A008-0040 follow-up; owner design review of the upload flow
Recorded: 2026-09-02
Raised: 2026-09-04, by A008-0056

## Context

`ingest()` creates exactly one `Utterance` from the whole of `content`,
whatever its length:

```ts
const utterance: Utterance = { /* ... */ content, artifactId: storedArtifact.id };
const storedUtterance = options.store.addUtterance(utterance);
return { artifact: storedArtifact, utterances: [storedUtterance] };
```

That is correct for the only caller today. `live-commit.ts` ingests one
dialogue turn, and one turn is one utterance.

It is wrong for an uploaded document. A twenty-page PDF becomes a single
utterance whose speech act and content kind were chosen by `classifySpeech()`,
whose heuristics are tuned for chat messages — `isPrediction` matches the
literal string `will probably rain`, `isQuotation` checks whether the whole
content starts and ends with a quote mark. Run over an extracted document those
tests are not merely inaccurate, they are answering a different question.

`IngestResult` already anticipates the fix:

```ts
export interface IngestResult {
  readonly artifact: Artifact;
  readonly utterances: readonly Utterance[];   // plural
}
```

The shape allows many. The implementation always returns one.

## Outcome sought

One artifact, many utterances, each independently classified and independently
addressable, so that a claim can cite the part of a document it came from rather
than the document as a whole.

## Why it matters beyond tidiness

- **Retrieval granularity.** The hybrid reader scores and budgets candidates.
  With one utterance per document, the unit of retrieval is the entire file:
  either the whole thing enters the projection budget or none of it does.
- **Citation.** Provenance currently answers "which file", because the artifact
  is the finest available grain. Answering "which passage" needs the utterance
  to be smaller than the file.
- **Classification honesty.** A document is many speech acts. Stamping one on
  the whole is a guess recorded as fact, in a store whose value is that its
  records are trustworthy.

## What this is *not*

An earlier reading of this problem — recorded in the A008-0040 archive, handoff,
and journal entry — named `ContentKind` as the blocker for uploads. That was
wrong, and the archives are immutable, so the correction lives here.

`ContentKind` is a genre axis, not a medium axis: `forecast`, `instruction`,
`prayer`, `source_code`. A PDF containing a weather forecast *is* a `forecast`;
that it arrived as a file is carried by `Artifact.locator`, and how its text
relates to the file is carried by the `relation` parameter A008-0040 added.
"Uploaded document" needs no enum value.

Two supporting observations, both verified:

- `contentKind` drives exactly one behaviour anywhere in `src/`:
  `interpret()` returns an empty proposal unless it is `source_code`. Every
  other site carries it as metadata.
- ADR 0018 does not mention `ContentKind`. The enum is not a frozen decision, so
  changing it later needs no ADR amendment.

Machine provenance is likewise already expressible. A vision model's
description of an image is correctly ingested as `speaker: "<the model>"` with
`relation: "derived_from"`, which keeps it from being attributed to the
uploading user and from passing `user-assertion-v1` as a user assertion. A
dedicated `origin: human | machine` field on `Utterance` would be cleaner than
overloading `ContentKind`, but no consumer reads such a field yet, so adding one
now would be speculative.

## Open questions to settle before starting

1. **Where does splitting belong?** Inside `ingest()`, or in a caller that hands
   `ingest()` pre-split content? The latter keeps `ingest()` a single-utterance
   primitive and puts document knowledge in the upload path where it belongs.
2. **What is the unit?** Page, paragraph, heading section, or a token budget.
   Different answers suit prose and tables.
3. **How is order preserved?** `Utterance` carries no sequence or offset today,
   so reassembling a passage in order, or citing a location, needs a new field.
4. **Does `classifySpeech()` run per chunk, or should a non-dialogue caller be
   required to state the kind?** Guessing per chunk multiplies the guessing.

## Why this is now due

The paragraph below said this should be taken "no later than" the point an
upload path is actually built. That point has arrived. A008-0056 made PDF and
Word documents readable, and the owner's own test documents run from 1 829 to
16 291 characters — each of which currently becomes exactly one `Utterance`,
classified by heuristics written for chat messages.

The cost of waiting is now concrete rather than theoretical: every document
ingested from here on is stored at file granularity, and re-chunking them later
means re-ingesting them, because the utterance is the record.

One thing A008-0056 settles that this item did not know: the extractors already
produce paragraph-per-line text, and both formats agree on where the lines are.
Open question 2 — what the unit is — therefore has a cheap first answer that
needs no new parsing: the blank-line-separated block. That is not obviously the
right unit for tables, but it is available today at no cost.

## Dependencies

None blocking. A008-0040 already opened the `relation` parameter this path
needs. Chunk granularity is baked into every stored record and is expensive to
change afterwards.

## Suggested verification

Ingest a multi-section document and assert: the utterance count matches the
section count; each utterance carries its own act and kind; every utterance
shares one `artifactId`; original order is recoverable; and a claim recorded
from one utterance cites that section rather than the file.
