# A008-0172 â€” Restore durable knowledge domain classification

Task ID: A008-0172
Parent Task: A008-0171
Status: In Progress
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

- [ ] Prompt-contract regression passes.
- [ ] Existing focused semantic-json/extractor tests pass.
- [ ] git diff --check passes.

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

- [ ] Claim task and create isolated worktree.
- [ ] Patch extractor domain guidance.
- [ ] Add deterministic regression assertion.
- [ ] Run focused verification.
- [ ] Update owned docs/handoff and archive task.

## Decisions and Notes

- Do not add a runtime default domain. An invented catch-all would hide
  classification failure and pollute retrieval.
- Domain is treated as broad knowledge classification; tags/entities remain
  optional sparse retrieval metadata.
