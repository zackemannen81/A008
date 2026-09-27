# A008-0193 — Memory label envelope

Task ID: A008-0193
Status: Complete
Owner: ChatGPT (operator)
Date: 2026-09-27

## Goal

Send the readable retrieved-record `label` to the worker together with the user
message, without changing the memory engine or extractor semantics.

## Delivered

- `ContextKnowledgeItem` can carry the retrieved record label.
- `projection-items.ts` preserves `RetrievedRecord.label` in the projection.
- `serialization.ts` now has a dedicated worker projection:
  `id + semanticAddress? + label + history? + provenance?`.
- `memory-prompt-composer.ts` uses that worker projection.
- The worker memory system instruction documents the label contract.
- Extractor serialization remains engine-oriented with `currentState`/`claim`.
- Current architecture/status docs describe the split presentation explicitly.

## Verification

- `npm run typecheck`: PASS.
- Focused suites: 63/63 PASS.
- ACP process fixture: PASS.
- No live provider calls; 0 SEK.

See `docs/handoffs/A008-0193.md`.
