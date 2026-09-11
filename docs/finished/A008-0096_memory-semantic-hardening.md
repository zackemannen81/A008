# A008-0096 Memory semantic hardening

Task ID: A008-0096
Status: Complete pending post-review verification
Owner: mrWhite, A008 (operator)
Completed: 2026-09-11

## Outcome

The live knowledge commit path no longer uses a regex mini-parser to infer canonical proposition structure from free-text proposals. Structured claim data can now be carried explicitly from INTERPRET/staging and is deterministically validated against the existing claim proposition model; genuinely unstructured dialogue claims retain the explicit `statement` fallback.

User-assertion acceptance is support-span aware. A mixed utterance may contain both a request and a factual assertion without the request turning into world state or suppressing an independently supported assertion. Exact support remains runtime-resolved from the original message/source.

Write-side domain capping now applies only to the aggregated utterance label surface. Each proposal/claim retains its own domains. Claim certainty is derived from staged confidence rather than a single hardcoded certainty. Statement fallback identity no longer copies full proposition text into entity labels; when no staged entity exists it uses a stable non-semantic statement identifier.

The inspection projection suppresses duplicate direct provenance edges while retaining provenance records and provenance nodes.

## Changes

- `src/memory/knowledge/assertion-evidence.ts`: shared deterministic, support-span-aware user-assertion boundary.
- `src/memory/knowledge/accept.ts`: acceptance consumes exact support spans when available.
- `src/runtime/user-assertion-gate.ts`: activation uses the same span-aware boundary.
- `src/memory/knowledge/claim-proposition.ts`: validates optional structured claim propositions without reparsing free text.
- `src/orchestration/post-output-knowledge-intake.ts`: preserves proposal domains and carries validated structured propositions through staging.
- `src/orchestration/semantic-json-model.ts`: exposes the existing canonical proposition shapes to the analyzer as optional structured output; unstructured fallback remains valid.
- `src/memory/knowledge/write-policy.ts`: bounds utterance-domain aggregation, maps confidence to claim certainty, and provides safe statement fallback identity.
- `src/memory/knowledge/live-commit.ts`: preserves structured staged claims, derives certainty, bounds only utterance domains, and keeps per-claim domains intact.
- `src/memory/knowledge/inspection.ts`: suppresses duplicate logical direct provenance edges without removing stored provenance.
- `test/A008-0096-semantic-hardening.test.ts`: focused regressions for mixed request/assertion evidence, acceptance, domain preservation/cap, structured staging, certainty/identity fallback, and inspection deduplication.

## Verification

The pre-review implementation passed `npm run typecheck`, 62 focused tests, and the full suite (558 core, 4 membership, 156 GUI). The post-review hardening above adds new source and regression tests and therefore requires a fresh local verification before merge:

- `npm run typecheck`
- `npm test`
- `git diff --check origin/main...HEAD`

No CI workflow is configured on this repository, so these post-review checks are intentionally not claimed as passed here.

## Scope Review

No SQLite schema migration, provider/model swap, retrieval redesign, or historical-record rewrite was introduced. The changes remain inside the frozen A008-0096 semantic-boundary charter.
