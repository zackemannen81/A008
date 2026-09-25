# A008-0172 â€” Restore durable knowledge domain classification

Task ID: A008-0172
Parent Task: A008-0171
Status: Complete
Owner: ChatGPT (operator/worker)
Created: 2026-09-24
Last updated: 2026-09-24
Charter frozen at: 2026-09-24

## Goal

Restore reliable broad-domain classification for durable dialogue knowledge without
reintroducing noisy generic metadata stamping.

## Primary Deliverable

A bounded extractor-contract repair plus regression coverage proving that
classifiable durable knowledge is instructed to carry the smallest useful domain
set while tags and entities remain sparse.

## In Scope

- Refine the normal dialogue knowledge extractor prompt's domain guidance.
- Keep tags and entities optional/sparse.
- Add prompt-contract regression coverage for the domain-vs-sparse distinction.
- Update current memory/system documentation only where behavior wording changes.

## Out of Scope

- Runtime fallback domains such as "general".
- Changes to label persistence, retrieval ranking, current scope, state semantics,
  relation classification, or source-ingestion extraction.
- Live-provider verification unless deterministic coverage is insufficient.
- Reclassifying already stored unlabeled records.

## Definition of Done

- The extractor contract states that classifiable durable artifacts normally
  carry the smallest useful domain set, usually one domain.
- Sparsity guidance no longer permits omitting a domain solely for sparsity.
- Generic workflow labels remain discouraged.
- Existing staging/commit domain persistence remains unchanged.
- Focused prompt tests pass and git diff --check passes.

## Necessity Gate

Contract: docs/PROJECT_BRIEF.md, Core Product Contract
Contract revision: ddbadb93207207bffd4726c4981083f34f66e908

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Restore dialogue domain classification | PC-02 requires project-scoped retrieval using stored labels, classified domains and accumulating domain scope; PC-04 requires durable post-turn proposals to persist through the accepted knowledge model | Newly extracted durable records currently arrive without domains and collapse into the Unlabelled retrieval cluster, weakening domain/current-scope retrieval | Change extractor instructions only; do not add runtime defaults or new classifiers | Prompt-contract test distinguishing expected domain classification from sparse tags/entities; focused memory tests |

## Minimum Verification Gates

- [x] Prompt-contract regression passes.
- [x] Existing focused semantic-json/extractor tests pass.
- [x] git diff --check passes.

## Verification Budget

No live provider call is required. Deterministic contract verification is
sufficient for this regression.

- max_live_verification_cost: 0 SEK
- max_live_verification_calls: 0

## References

- docs/PROJECT_BRIEF.md â€” PC-02, PC-04
- docs/CURRENT_MEMORY_MODEL.md â€” Domains and retrieval sections
- src/prompt-contracts/KNOWLEDGE_EXTRACTOR_INSTRUCTION.ts
- test/semantic-json-model.test.ts
- C:\log\a008-log.txt â€” observed regression: 16 non-empty extraction responses, only one with domains; post-0171 outputs omit domains while still emitting tags

## Checklist

- [x] Claim task and create isolated worktree.
- [x] Patch extractor domain guidance.
- [x] Add deterministic regression assertion.
- [x] Run focused verification.
- [x] Update owned docs/handoff and archive task.

## Decisions and Notes

- Do not add a runtime default domain. An invented catch-all would hide
  classification failure and pollute retrieval.
- Domain is treated as broad knowledge classification; tags/entities remain
  optional sparse retrieval metadata.

## Completion

Implemented on `codex/a008-0172-domain-classification-regression`.

The dialogue extractor now treats domains as broad retrieval classification
rather than optional sparse metadata. Every durable artifact whose subject can
be safely classified is instructed to emit the smallest useful broad domain set,
normally one and at most two when genuinely cross-domain. Tags and entities
remain optional and sparse. Domain phrases may be derived from subject matter
without being copied verbatim from the source.

No runtime fallback domain was added. Existing staging, label persistence,
retrieval ranking, current-scope, state and relation-classification behavior are
unchanged.

## Verification

- Local log evidence: 16 non-empty knowledge-analysis responses were observed;
  only one contained domains, and the post-A008-0171 responses omitted domains
  while several still emitted tags.
- Focused extractor/intake/prompt tests: 60/60 passed.
- TypeScript typecheck: passed.
- `git diff --check`: passed before closure.
- Live provider calls: 0; cost: 0 SEK.

## Documentation Updates

- `docs/CURRENT_MEMORY_MODEL.md` now separates domain classification from sparse tags/entities.
- `docs/SYSTEMDOC.md` records the same implemented dialogue-extraction behavior.
- `docs/CURRENT_STATUS.md` is unchanged because it records merged observed reality; integration remains an operator step.
- `docs/JOURNAL.md` is intentionally unchanged on the worker branch; the operator appends it on merge.

## Handoff and Follow-ups

- Current state: implementation and deterministic verification complete locally.
- Implementation commit: `e4f7727d639d91c53939732963792ad829468f59`.
- Next recommended step: operator review, then push/PR/merge if accepted.
- Blockers: none.
- Follow-up outside scope: existing unlabeled records are not retroactively reclassified.
