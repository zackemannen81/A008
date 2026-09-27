# Current Task

Task ID: A008-0189
Parent Task: None
Status: Complete
Owner: Codex (operator), requested by Rickard
Created: 2026-09-27
Last updated: 2026-09-27
Charter frozen at: 2026-09-27

## Goal

Build the owner-approved minimal, relevant memory envelope for model requests.

## Primary Deliverable

Working projection/serialization and regression coverage: id, optional resolved
semanticAddress, currentState or latest applicable claim as text, with history
and provenance only when required. Internal metadata and identity remain in A008.

## In Scope

Provider projection, bounded admission using existing retrieval signals, same-turn
extractor serialization/prompt, preserving reinforcement mapping, current-state
precedence and address-aware deduplication, optional history/provenance, related
documentation and meaningful tests. Existing storage remains intact.

## Out of Scope

Session process architecture, database/schema migration or user database cleanup,
new provider integration, global semantic reranker, new paid services, push/deploy.

## Definition of Done

- Model-facing items contain only the agreed base and optional fields.
- Current state wins over claims for the same address; different addresses with
  identical values remain independent. Null/false/zero and qualifications survive.
- History and provenance are conditional and preserve necessary attribution/time.
- Specific retrieval signals narrow broad domain spillover; exact reads remain
  available and diagnostics identify omissions.
- Worker/extractor use the same minimal baseline; internal evidence identities
  still resolve reinforcement. Reading alone does not reinforce knowledge.
- Typecheck, focused regressions, full core suite and diff review are recorded.
- Owning docs, completed task archive/handoff and restored task template exist.

## Necessity Gate

Contract revision: 0d8e409f464ac32dca02d73ac969b2581428ccc7.
Authority: PROJECT_BRIEF PC-LF-03/04/10; CURRENT_MEMORY_MODEL sections 31, 34–43,
47; owner's explicit minimal-envelope and reuse/reinforcement instructions.
ADR 0056 records the approved refinement before implementation.

| Change | Authority | Observable need | Smallest sufficient approach | Verification |
| --- | --- | --- | --- | --- |
| Minimal projection and conditional context | PC-LF-03, memory model 34–43, owner request | Avoid duplicate values and unrelated/internal metadata in worker context | Shared model serializer plus projection admission; retain internal records | Envelope allowlist, state/claim, history/provenance and relevance regressions |
| Identity-safe reuse | PC-LF-03, model 47, owner clarification | Compact output must not lose reinforcement identity or merge unrelated facts | Retain exact item IDs/evidence mapping; address-aware dedupe | Same-turn extraction and SQLite reinforcement/state-history tests |

## Minimum Verification Gates

Root typecheck; focused memory projection/orchestration tests; full core suite;
git diff --check. No new provider API behavior is introduced. Local synthetic
fixtures verify payload and identity behavior; no live inference is required.

## Verification Budget

No live verification required: calls 0, cost 0 SEK, input/output token limit 0,
timeout 0. No user payload or private store is sent externally.

## Checklist

- [x] Read current owners and inspect source; allocate ID on local main.
- [x] Record ADR and implement bounded projection/admission changes.
- [x] Verify and update owning docs.
- [x] Archive, hand off and restore template.

## Notes

Initial working tree had three unrelated deleted docs/A008-0187-*.txt files;
leave them untouched. No commit/push authorized or required for local delivery.
Internal rich records are not a second semantic owner; model JSON is a derived
projection with an exact mapping back to the selected records.

## Completion evidence

Typecheck and build passed. Final focused suite: 138/138. Core suite: 772/778,
with all six failures reproduced on the untouched base. Diff check passed.
See [handoff](../handoffs/A008-0189.md) for behavior, evidence and limits.
No commit/push; journal deferred to merge. Current-task template restored.
