# A008-0143 â€” Atomic knowledge state ownership and reinforcement semantics

Task ID: A008-0143
Parent Task: None
Status: Complete
Owner: A008 (operator)
Created: 2026-09-20
Last updated: 2026-09-20
Charter frozen at: 2026-09-20

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- Relevant lifecycle/retrieval ADRs and completed tasks, as history only where later authority has changed the same semantic boundary.

## Task Summary

Restore A008 memory to one simple ownership rule: for each resolved semantic address, **current state is the SSOT truth**. A later valid update to the same address atomically takes ownership; the previous current value becomes history. Time/validity is therefore part of state semantics, not optional metadata.

Correct the reinforcement rule at the same time. A knowledge state that becomes semantically actual/relevant in a distinct occurrence is reinforced exactly once for that occurrence. Reinforcement is never skipped because an exact quote, source span, or provenance attachment cannot be verified. Provenance/evidence validation remains strict but separate from lifecycle reinforcement.
## Goal

Make live memory behave as atomic versioned state instead of an accumulating set of competing assertions, while preserving evidence/provenance as explanation rather than truth ownership.

## Primary Deliverable

A corrected knowledge constitution/decision boundary plus the smallest implementation changes needed so that:

1. one semantic address has one current truth;
2. later valid state atomically moves previous current state to history;
3. temporal meaning is preserved and usable by reconciliation;
4. reinforcement cannot be gated or skipped by evidence-span validation;
5. strength affects broad/fuzzy recall eligibility, never current truth or exact/direct eligibility.

## In Scope

- Amend the authoritative memory documentation where it currently binds automatic reinforcement to a fresh exact supporting assertion/quote.
- Record the owner decision of 2026-09-20: semantic actuality/relevance in a distinct occurrence is sufficient for reinforcement.
- Make current state the explicit SSOT for a resolved semantic address; claims, utterances and provenance may explain state but do not own truth.
- Preserve history as prior valid state, not degraded/competing current knowledge.
- Carry enough temporal/occurrence ordering through live dialogue commit that a later current-state update can deterministically sequence after the earlier state instead of collapsing to `UNKNOWN_INSTANT`.
- Preserve explicit past/future temporal qualifiers; do not globally substitute ingestion time for world/event time.
- Ensure an unresolved/unstructured proposition cannot invent a sentence-hash semantic address and enter current state as synthetic truth.
- Separate evidence attachment from reinforcement: a failed quote/span/provenance check may refuse that evidence attachment, but must not refuse reinforcement when the knowledge state became actual/relevant.
- Keep direct/exact current-state retrieval eligible regardless of strength threshold; apply strength primarily to broad/fuzzy candidate admission.
## Out of Scope

- A new memory architecture, second truth store, new version chain, or new identity scheme.
- MongoDB/NoSQL migration or any storage-engine replacement.
- ACME ownership changes.
- GUI redesign.
- Reconstructing current truth at retrieval time from a pile of claims.
- Treating strength, confidence, recency or claim count as truth authority.
- Bulk destructive rewriting of existing user databases without a separately reviewed repair/migration step.
- New fuzzy-merging heuristics for entity identity.
- Expanding same-time multi-source conflict semantics beyond what is required to stop missing temporal order from creating false conflicts.

## Definition of Done

- `Rickard.preferred_name = Bertil` followed later by current-state `Rickard.preferred_name = Rickard` yields exactly one current value, `Rickard`, with `Bertil` retained in history.
- `A008-0142.status = Draft` followed later by `In Progress` yields `In Progress` as current and `Draft` as history, not two current states.
- An explicitly historical assertion is placed/amended in the appropriate historical interval and does not silently replace an unrelated current state.
- An explicitly future event/state is not treated as current merely because it was asserted now.
- A current-state direct/exact match is returned even when its strength is below the broad/fuzzy threshold.
- A broad/fuzzy candidate below threshold may be excluded without changing its truth/current-state status.
- A knowledge state becoming actual/relevant in a later occurrence reinforces exactly once even when the later text is not an exact restatement.
- Quote/span/provenance verification failure cannot produce a `reinforcement skipped` outcome; it can only affect evidence attachment.
- Repeated use of the same knowledge inside one occurrence does not multiply reinforcement.
- No sentence hash or synthetic statement entity can become a substitute semantic address for current truth.
### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3532bcd8a0546e79dde1dbdb4e2623ca387ad0c6`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Restore atomic current-state ownership and temporal sequencing | PC-04; ADR 0018 D1/D3/D4; owner direction 2026-09-20 that current state is SSOT and later valid state owns the same semantic address | Live dialogue can otherwise retain competing current values because temporal order is discarded, forcing retrieval to guess truth | Repair live temporal/semantic-address propagation and deterministic reconcile/update use; reuse the existing state/history engine | Bertilâ†’Rickard, Draftâ†’In Progress, historical and future-time regressions |
| Correct reinforcement semantics | PC-02/PC-04; owner direction 2026-09-20 explicitly supersedes the exact-support recurrence requirement for reinforcement | Relevant knowledge can decay despite becoming actual again, while new variants accumulate; source-span failures incorrectly suppress memory strengthening | Amend constitution/affected decision text and decouple reinforcement from evidence-span acceptance; one boost per distinct occurrence | semantic reactivation without restatement, quote-not-found, duplicate-occurrence regressions |
| Preserve retrieval truth/salience separation | PC-02/PC-04; ADR 0018 D7 survives: direct state match is not strength-gated | Low-strength current truth can otherwise disappear from exact answers or strength can become a truth proxy | Preserve direct/exact eligibility; keep strength as broad/fuzzy salience input only | below-threshold direct vs fuzzy retrieval regression |
| Remove synthetic truth fallback | PC-04; knowledge model L1/L12 semantic addressing and unresolved-reference rules | Sentence-hash entities can create parallel current states instead of updating the real slot | Keep genuinely unresolved material as evidence/unresolved information; do not commit it as synthetic current state | unstructured-proposition regression proving no synthetic current binding |
### Minimum Verification Gates

- [x] Focused in-memory tests for atomic state/history transitions and temporal ordering.
- [x] Focused live post-output tests proving dialogue commits carry usable state time/order.
- [x] Reinforcement tests: semantic actuality, non-restatement wording, quote/span failure, and exactly-once-per-occurrence.
- [x] Retrieval tests proving direct/exact ignores strength threshold while broad/fuzzy may use it.
- [x] Regression proving unresolved/unstructured input cannot create sentence-hash current truth.
- [x] Existing knowledge-model acceptance scenarios remain green or are updated only where this owner decision explicitly changes reinforcement semantics.
- [x] SQLite parity/restart tests for every affected persisted behavior.
- [x] `npm run typecheck`.
- [x] Affected core/memory test suites and full repository test suite, or explicit named omissions with reasons.
- [x] Final diff reviewed against this charter; remove/reroute any new abstraction not required by these outcomes.

## References

- `docs/PROJECT_BRIEF.md` PC-02 and PC-04
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `src/memory/knowledge/`
- `src/orchestration/post-output-knowledge-intake.ts`
- `src/orchestration/relation-gated-memory-commit.ts`
- `src/memory/knowledge/live-commit.ts`
- Owner decisions recorded 2026-09-20 in this charter.
## Checklist

- [x] Re-read the authoritative model and enumerate every current contradiction with this frozen owner direction before editing.
- [x] Add failing regressions for Bertilâ†’Rickard, task-status transition, historical/future time and competing-current-state defects.
- [x] Correct constitution/ADR text so current state, history, time and reinforcement semantics have one owner.
- [x] Trace `analyzer â†’ structured proposition â†’ semantic address â†’ time/validity â†’ RECONCILE â†’ UPDATE` and repair only the broken boundaries.
- [x] Remove synthetic sentence-hash state fallback from the current-truth path; preserve unresolved evidence without inventing truth.
- [x] Separate evidence/provenance verification from reinforcement.
- [x] Implement exactly-once reinforcement per distinct actual/relevant occurrence.
- [x] Verify direct/exact versus broad/fuzzy strength behavior.
- [x] Run focused, SQLite/restart, typecheck and repository gates.
- [x] Update owning docs to observed behavior only.
- [x] Archive, hand off and restore `docs/CURRENT_TASK.md` template before final push.

## Decisions and Notes

- This task is a correction to existing authority where the current constitution/ADR text requires exact supporting recurrence for automatic reinforcement. That requirement is explicitly withdrawn by the owner on 2026-09-20.
- **Current state is the truth surface. History is prior valid state. Evidence/provenance explains why state changed. Strength controls salience/recall, not truth.**
- A later valid update to the same semantic address takes ownership atomically. The previous current value becomes history; it does not remain a competing current truth.
- Reinforcement is about knowledge becoming actual/relevant again. Exact textual repetition is not required.
- Evidence attachment may still fail closed when source support cannot be verified. That failure must not be reused as a reinforcement gate.
- Do not solve this by adding another versioning abstraction, another canonical-status field, or retrieval-time truth reconstruction.
- Existing storage and ontology are reused unless a concrete failing acceptance test proves a bounded change is necessary.
- 2026-09-20 claim-boundary audit found two claim layers: evidence `Claim` and reconciliation `SlotClaim`. `SlotClaim` is retained only as a synchronized reconciliation shadow; current truth remains the open binding. Its accepted/contested status and validity interval now follow the evidence/state transition it represents.
- Current-state retrieval may use claims/utterances/tags/domains to discover a semantic address, but projects that address's HEAD binding. State-backed claim/utterance text is suppressed on pure current-state reads and remains available for explicit attribution/history.
- Unstructured propositions remain evidence claims and entity references; they create no sentence-hash entity, synthetic `statement` slot or binding.
- Git/HEAD analogy: treat `current_state` like the checked-out `main` HEAD. Read the current state, change only the affected semantic address, and commit one atomic transition. The resulting state is the new truth surface; earlier states remain history/provenance, like prior commits. Retrieval must not vote among old commits to rediscover HEAD.

## Charter Amendment Log

- none

## Verification

- [x] Record exact commands/results.
  - `npm run typecheck && npm run build --silent && node --test dist/test/A008-0122-memory-contract-repair.test.js dist/test/current-scope.test.js dist/test/knowledge-labels.test.js dist/test/local-memory-runtime.test.js dist/test/source-commit-origin.test.js` â€” 70/70 pass before the final task-status regression was added.
  - `npm run build --silent; node --test dist/test/A008-0122-memory-contract-repair.test.js` â€” 11/11 pass including explicit `Draft -> In Progress`.
  - `npm run test:core` â€” 687/687 pass before that final regression; final repository run recorded below includes 688 core.
  - `npm test` after archival and `CURRENT_TASK` restoration â€” core 688/688, membership 4/4, GUI 178/178; 0 fail/skip/cancel/todo. The initial GUI attempt failed before test execution because `gui/node_modules` lacked `esbuild`; `npm --prefix gui ci` restored the lockfile dependencies without repository file changes.
  - HEAD regression proves an old tagged Bertil claim can discover `preferred_name`, while provider projection contains only current state `Rickard`; explicit attribution still returns the historical claim.
- [x] Record any affected model/ADR clauses amended by this task.
- [x] Record any existing-data repair left for a follow-up.
  - Prevention is complete. Existing stores that already contain synthetic statement bindings or otherwise competing legacy current state are not rewritten automatically; repair/backfill requires a separately reviewed migration if encountered.

## Documentation Updates

- [x] `docs/KNOWLEDGE_MEMORY_MODEL.md`
- [x] affected ADR(s), explicitly marking superseded clauses rather than leaving parallel authority
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` on merge — intentionally deferred to the operator per worker handoff rules
- [x] `docs/FILESTRUCTURE.md` only if structure changes — no structure change; standard finished/handoff locations only

## Handoff and Follow-ups

- Current state: Complete on the task branch; atomic HEAD, temporal ownership, reinforcement and claim/read-boundary corrections are implemented and repository-green.
- Next recommended step: operator smoke-test a fresh chat/store, then review and merge the PR if the live behavior matches the automated proof.
- Blockers: none known in the active 0143 worktree.
- Child tasks: none at freeze.
- Open questions: existing corrupted/currently competing live records may require a separately reviewed repair step after prevention is verified.

## Finalize When Complete

- Archive under `docs/finished/A008-0143_atomic-knowledge-state-ownership.md`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from `docs/template_CURRENT_TASK.md`.
- Write `docs/handoffs/A008-0143.md`.
- Push/open PR; do not merge from a worker.
