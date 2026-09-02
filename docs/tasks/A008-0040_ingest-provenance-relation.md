# Task A008-0040 — Caller-named INGEST provenance relation

Status: Ready
Owner: Operator
Created: 2026-09-02
Charter frozen at: 2026-09-02
Branch: `claude/A008-0040-ingest-provenance-relation`

## Task summary

`ingest()` hardcodes `relation: "appears_in"` on the utterance-to-artifact
provenance record. That is correct for the only caller today: `live-commit.ts`
ingests a dialogue turn, and the utterance text is literally part of that turn.

It is wrong for any path where the content was produced *about* an artifact
rather than taken *from* it. A vision description of an uploaded image is the
motivating case: no text appeared in the JPEG, a model wrote a description of
it. Ingesting that through the current path would make the provenance graph
assert that model-written text was present in the user's file, in a system whose
purpose is traceable evidence.

`ProvenanceRelation` already carries `derived_from` for exactly this. The value
exists; `ingest()` simply does not let a caller reach it.

While confirming the change, two test files were found to be absent from the
`test:core` script and therefore never executed: `evidence.test.ts` — which is
where `ingest()`'s own tests live — and `state-history.test.ts`. Both pass when
run by hand (20 cases). A change to `ingest()` cannot be honestly verified while
its test file is outside the gate, so wiring both in is part of this task.

## Goal

A caller names the provenance relation for the evidence it ingests, and the
tests that cover `ingest()` run in the repository gate.

## Primary deliverable

An optional `relation` on `IngestInput`, honoured by `ingest()`, defaulting to
today's behaviour.

## In scope

- `src/memory/knowledge/ingest.ts`: optional `relation` on `IngestInput`;
  validated at runtime before any store mutation; default `appears_in`.
- New cases in `test/knowledge-model/evidence.test.ts`.
- `package.json`: add `dist/test/knowledge-model/evidence.test.js` and
  `dist/test/knowledge-model/state-history.test.js` to `test:core`.
- `docs/CURRENT_STATUS.md` test count.

## Out of scope

- Making `test:core` discovery-based. That is the root fix for the orphaned-file
  class of defect and mirrors what A008-0039 did for the GUI, but it carries a
  stale-`dist/` question that deserves its own decision. Routed to the backlog.
- Any `ContentKind` addition. Uploaded documents and model-written image
  descriptions still have no fitting value; that is a separate open question.
- Any image, vision, or upload path implementation. This task only opens the
  parameter such a path will need.
- The public export surface. `ingest` and `ProvenanceRelation` are not exported
  from `src/index.ts` and stay that way.
- `live-commit.ts`. Its dialogue ingest is correct as `appears_in` and must keep
  working untouched, which is what the default preserves.

## Definition of done

- A caller can pass `derived_from` and see it on the stored provenance record.
- Omitting `relation` produces byte-identical behaviour to before this change.
- An invalid relation fails closed and leaves no artifact, utterance, or
  provenance behind.
- `npm test` executes `evidence.test.ts` and `state-history.test.ts`.

## Minimum verification gates

- [ ] A test asserting the default relation is `appears_in`.
- [ ] A test asserting an explicitly passed `derived_from` is stored.
- [ ] A test asserting an invalid relation throws `KnowledgeModelError`
      (`invalid_input`) **and** that the store is untouched afterwards.
- [ ] `npm run typecheck` clean.
- [ ] `npm test` green, with a count that accounts for exactly: the 243
      baseline, the 20 previously-orphaned cases, and the new cases.

## References

- `src/memory/knowledge/ingest.ts`
- `src/memory/knowledge/evidence-types.ts` — `ProvenanceRelation`
- [`../adr/0018-knowledge-and-memory-model.md`](../adr/0018-knowledge-and-memory-model.md)
- [`../backlog/gui-hardening.md`](../backlog/gui-hardening.md)

## Decisions and notes

- ADR 0018 is not amended. The relation vocabulary is unchanged; this task only
  stops `ingest()` from deciding on the caller's behalf.
- The default must stay `appears_in` so `live-commit.ts` and every existing
  stored record keep their meaning. This is an additive change.
- Validation runs before `addArtifact`, so a rejected call cannot leave a
  partial write. That ordering is itself a gate.
