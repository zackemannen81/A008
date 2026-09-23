# A008-0171 — Librarian prompt contract simplification

Task ID: A008-0171
Parent Task: A008-0169
Status: Ready
Owner: ChatGPT (operator/worker)
Created: 2026-09-23
Charter frozen at: 2026-09-23
Branch: codex/a008-0171-librarian-prompts
Clone: C:\code\A008-workers\A008-0171

## Goal

Align the normal chat-turn prompt contracts with the simpler librarian model:
retrieve a small relevant current baseline, let extraction compare the completed
turn against that exact baseline, and let deterministic commit own canonical
state/history.

## In scope

- Tighten dialogue extractor identity rules for retrieved item id vs evidence id.
- Make state-update semantic-address preservation explicit and internally
  consistent with structured propositions.
- Define the exact aboutInterval wire shape.
- Simplify relation-classifier wording so same-address identity is decisive and
  HEAD/history/lifecycle are not model-owned.
- Make retrieval-scope maxima explicit ceilings, not targets.
- Keep the memory context system instruction small and current-state oriented.
- Add focused prompt-contract regressions based on C:\log\a008-log.txt.

## Out of scope

- Changing state/commit/reconciliation code.
- Changing retrieval algorithms or projection surfaces.
- Source-ingestion prompt simplification.
- ACME changes.
- Runtime budget changes.

## Definition of Done

- Reinforcement instructions require copying retrievedContext.items[].id exactly
  and explicitly forbid using evidenceId as knowledgeId.
- A state update can target an existing state only by copying its semanticAddress
  exactly; structured proposition and semanticAddress must describe the same slot.
- Different semantic addresses cannot be classified as restatement/supersede/conflict.
- Current/history/lifecycle ownership remains deterministic runtime responsibility.
- Focused prompt/model tests and full repository verification pass.
- No live provider calls; 0 SEK.
