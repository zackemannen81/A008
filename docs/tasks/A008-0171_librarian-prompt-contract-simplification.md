# A008-0171 — Librarian prompt contract simplification

Task ID: A008-0171
Parent Task: A008-0169
Status: Complete
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
- Fail closed in staging when a state_update semanticAddress was not retrieved
  as current state or disagrees with the attribute_binding slot.

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


## Completion

Implemented on `codex/a008-0171-librarian-prompts`.

Normal dialogue memory prompts now follow the simpler librarian contract:
- retrieval asks for the smallest useful label set and treats maxima as ceilings;
- retrieved current state is applicable knowledge while history, when explicitly
  present, is prior state and does not compete with current state;
- dialogue extraction copies retrieved identities instead of inventing them;
- reinforcement `knowledgeId` is the exact retrieved item `id`, never
  `evidenceId`;
- state updates must target a retrieved current-state semantic address and their
  structured attribute binding must resolve to the same slot;
- relation classification cannot restate/supersede/conflict across different
  semantic addresses and does not own Current State or History;
- dialogue metadata is sparse rather than stamped with generic turn-wide labels.

A deterministic intake guard now rejects a mismatched state-update address before
relation classification/commit, reproducing and closing the failure observed in
`C:\log\a008-log.txt`.

The source-ingestion-only `POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION` was
reviewed but intentionally left unchanged; it is not the normal chat-turn path.

## Verification

- Focused librarian/memory tests: 86/86 passed.
- Core: 765/766 passed. The only failure,
  `Luna semantic retrieval and extraction omit unsupported temperature through ACME`,
  reproduces unchanged on main and predates this task (hotfix `8b2796a`
  changed the default semantic model selection).
- Membership: 4/4 passed.
- GUI: 204/204 passed.
- `git diff --check`: passed.
- No live provider calls; 0 SEK.
