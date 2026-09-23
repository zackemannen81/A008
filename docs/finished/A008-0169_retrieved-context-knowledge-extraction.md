# A008-0169 — Retrieved-context knowledge extraction contract

Task ID: A008-0169
Parent Task: A008-0144
Status: Complete
Owner: ChatGPT (operator/worker)
Created: 2026-09-23
Charter frozen at: 2026-09-23
Branch: codex/a008-0169-knowledge-extractor-context
Clone: C:\code\A008-workers\A008-0169

## Goal and primary deliverable

Make post-response semantic extraction compare the completed turn against the
exact retrieved knowledge projection that was supplied to that turn. The
extractor receives retrieved knowledge, the original user message and the final
provider response in one explicit contract.

## In scope

- Preserve stable knowledge/evidence identity and semantic address on projected
  context items where the read path has them.
- Carry the exact same-turn retrieved projection into post-output extraction.
- Replace the dialogue extractor payload/prompt contract with explicit
  NEW_KNOWLEDGE, STATE_UPDATE, RELATION_UPDATE and REINFORCEMENT outputs.
- Adapt those outputs into the existing A008-owned commit/reconciliation path
  without moving semantic ownership to ACME.
- Add regression tests for payload identity, baseline comparison, duplicate
  suppression/reinforcement and state-update preservation.
- Update owning memory/system documentation and task records.

## Out of scope

- Platform V3 migration/import.
- ACME behavior or package changes.
- Retrieval ranking, history-intent rules or context-budget policy.
- Replacing the existing atomic commit/state/history implementation.
- Cross-session pending-turn overlays.
- Broad schema/storage migration unrelated to the extraction contract.

## Definition of Done

- Dialogue extraction receives retrievedContext + userMessage + responseText.
- Retrieved context contains the same projected artifacts used for provider
  context, including stable identity and semantic address when available.
- Existing context repeated as a duplicate is not staged as new knowledge;
  explicit reinforcement can target the existing artifact.
- State/relation updates remain explicit semantic candidates and reach the
  existing commit path.
- Source/document extraction remains source-only and backward-correct.
- Focused tests, typecheck/build, full test suite and diff hygiene pass.

## Necessity Gate

Contract: docs/PROJECT_BRIEF.md PC-02, PC-03 and PC-04; semantic authority:
docs/CURRENT_MEMORY_MODEL.md sections 31-50 and 62.
Contract revision: 1c19f92ef65daa6cfdb4a22e48679ced019d080c

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Inject same-turn retrieved projection into extraction | PC-02/03/04: A008 owns retrieval/context and durable semantic intake | Extractor can distinguish known/reused knowledge from new/changed knowledge; without it it sees only message+answer | Carry the already-built projection; never re-retrieve after answer | Analyzer input regression |
| Explicit extraction result classes | CURRENT_MEMORY_MODEL state/history/reinforcement separation | Duplicate, reinforcement and state change stop being conflated | Typed four-bucket analyzer result adapted into existing commit path | Intake/commit focused tests |
| Preserve projection identity/address | Context must be traceable to knowledge/state | Reinforcement cannot reliably name the artifact the worker actually saw | Add optional identity/address fields to context items from existing read records | Projection/prompt tests |

## Minimum Verification Gates

- [x] Root typecheck and build.
- [x] Focused post-output, projection and state-history tests.
- [x] Full npm test.
- [x] git diff --check.
- [x] No live provider calls; 0 SEK.

## Verification Budget

Live verification purpose / required provider behavior: not needed.
max_live_verification_cost: 0 SEK
max_live_verification_calls: 0

## Notes

The retrieved projection is a baseline, not a second retrieval. Dedupe and
reinforcement remain separate decisions. Commit-time dedupe remains mandatory.
A008 owns all semantic decisions; ACME remains execution only.


## Completion

Implemented on `codex/a008-0169-knowledge-extractor-context`.

- Same-turn projected knowledge now preserves stable item identity, evidence identity,
  semantic address and current state where available.
- Dialogue extraction receives `retrievedContext + userMessage + responseText`.
- Dialogue extraction separates `new_knowledge`, `state_updates`,
  `relation_updates` and `reinforcements`.
- Retrieval/admission no longer mutates lifecycle merely because an item was read.
  Explicit post-output reinforcement targets only an artifact from the retrieved
  baseline and remains exactly-once per turn/evidence occurrence.
- Existing batch relation classification and batch commit remain in place.
- Source/document extraction keeps the pre-existing source-only contract.
- Commit-time dedupe/reconciliation remains mandatory; extraction-time comparison
  does not replace it.

Verification is fixture/local only. No live provider calls and 0 SEK.
Focused memory/extraction gate: 111/111. Full core gate: 761/761.
Membership: 4/4. GUI: 204/204. `git diff --check` passed.
The worktree initially lacked `gui/node_modules`; GUI verification reused the
already-installed main-worktree dependency tree through a temporary junction,
which is removed before commit and is not repository state.
