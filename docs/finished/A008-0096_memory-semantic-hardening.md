# A008-0096 Memory semantic hardening

Task ID: A008-0096
Status: Complete
Owner: mrWhite, A008 (operator)
Completed: 2026-09-11

## Outcome

The live knowledge commit path no longer uses a regex mini-parser to infer canonical proposition structure from free-text proposals. Structured identity remains separate from proposition text: entity labels use staged entities, while genuinely unstructured dialogue claims use an explicit `statement` attribute fallback. Full propositions are no longer copied into entity labels.

The existing inspection projection suppresses duplicate direct provenance edges while retaining provenance records and provenance nodes. Existing speech-act, source-attribution, certainty, domain-label, and statement-slot protections remain covered by the knowledge-model tests.

## Changes

- `src/memory/knowledge/live-commit.ts`: remove regex proposition parsing; use the explicit statement fallback and keep entity labels free of proposition text.
- Existing inspection projection deduplicates logical direct provenance edges without removing stored provenance.

## Verification

- `npm run typecheck` — passed.
- Focused knowledge/commit/inspection tests — passed; 62 tests, 0 failures.
- `npm test` — passed; 558 core, 4 membership, and 156 GUI tests, 0 failures.

## Scope Review

No SQLite schema migration, provider/model swap, retrieval redesign, or historical-record rewrite was introduced. No push or merge was performed in this worktree.
