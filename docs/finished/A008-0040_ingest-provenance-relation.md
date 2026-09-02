# Task A008-0040 — Caller-named INGEST provenance relation

Status: Complete
Owner: Operator
Created: 2026-09-02
Completed: 2026-09-02
Branch: `claude/A008-0040-ingest-provenance-relation`
Base revision: 4049091

## Goal

A caller names the provenance relation for the evidence it ingests, and the
tests that cover `ingest()` run in the repository gate.

## Change

`IngestInput` gained an optional `relation`, defaulting to the exported
`DEFAULT_INGEST_RELATION` (`appears_in`). `ingest()` resolves and validates it
before `addArtifact`, so a rejected relation cannot leave a partial write.
Unknown values raise `KnowledgeModelError("invalid_input", …)`.

`test/knowledge-model/evidence.test.ts` and
`test/knowledge-model/state-history.test.ts` were added to `test:core`. Neither
had ever been executed by `npm test`; both passed on first run.

## Why

`ingest()` hardcoded `relation: "appears_in"`. That is true of the only caller
today — `live-commit.ts` ingests a dialogue turn, and the utterance is literally
part of it. It is false for content produced *about* an artifact rather than
taken *from* it. A vision model's description of an uploaded image never
appeared in that image; recording it as `appears_in` would write a false claim
into a provenance graph whose entire purpose is traceable evidence.

`ProvenanceRelation` already carried `derived_from`. Only `ingest()` stood
between a caller and the correct value.

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Types | `npm run typecheck` | clean |
| Full gate | `npm test` | 266 core + 63 GUI, 0 fail, exit 0 |
| Gate membership | every `test/**/*.test.ts` referenced | 43 of 43 |

266 accounts exactly for the 243 baseline, the 20 previously-orphaned cases,
and 3 new ones.

New cases in `test/knowledge-model/evidence.test.ts`:

- the default relation is `appears_in` and the record points at the artifact
- a caller-named `derived_from` is stored, with the file locator preserved and
  the vision model recorded as speaker rather than the uploading user
- an unknown relation throws `invalid_input` **and** leaves zero artifacts,
  utterances, and provenance records behind

### Mutation checks

Both halves proved load-bearing rather than assumed:

| Mutation | Result |
| --- | --- |
| restore the hardcoded `relation: "appears_in"` | 265 pass, **1 fail** |
| make the relation validation unreachable | 265 pass, **1 fail** |
| both reverted | 266 pass, 0 fail |

## Out of scope and not done

- `test:core` still names its files by hand. The root fix is routed to
  [`../backlog/discovery-based-core-suite.md`](../backlog/discovery-based-core-suite.md),
  which weighs three options; it is not a straight copy of the A008-0039 GUI fix
  because `dist/` is not cleaned on build, so a glob there could keep running a
  test whose source was deleted.
- No `ContentKind` value was added. An uploaded document and a model-written
  image description still have no fitting kind, and `classifySpeech()` picks one
  for the caller. That remains open and will need deciding before an upload path
  ships.
- No image, vision, or upload path was implemented. This task only opens the
  parameter such a path requires.
- `live-commit.ts` was not touched. Its dialogue ingest is correct as
  `appears_in`, which the default preserves.
- `ingest` and `ProvenanceRelation` remain unexported from `src/index.ts`.
