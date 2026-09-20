# A008-0144 — Canonical knowledge, memory and contextual-attraction model

Task ID: A008-0144
Parent Task: None
Status: Ready
Owner: A008 (operator)
Supersedes: A008-0143 where this charter changes memory/state semantics; predecessor implementation and evidence remain reusable input.
Created: 2026-09-20
Last updated: 2026-09-20
Charter frozen at: 2026-09-20

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_MEMORY_MODEL.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md` as prior authority/history where it conflicts
- `docs/tasks/A008-0143_atomic-knowledge-state-ownership.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/adr/0035-frozen-instruction-and-memory-target.md`
- Relevant completed lifecycle, association and retrieval tasks as implementation history.

## Task Summary

Owner review of the post-A008-0143 live smoke test confirmed that synthetic statement-state creation was stopped, but exposed a remaining semantic mismatch: resolved source/assistant-derived claims such as `ND-0001.status = In Progress` remain claims only because current-state update is still coupled to `user-assertion-v1`.

`docs/CURRENT_MEMORY_MODEL.md` now defines the owner-approved target: claims/evidence are the durable ledger, Current State is the single HEAD projection per resolved semantic address, provenance/support explains why knowledge exists, lifecycle controls salience only, and retrieval/context selects the minimum sufficient knowledge. Semantic associations gain signed contextual `attraction` independent of truth-bearing relationships.
## Goal

Make `docs/CURRENT_MEMORY_MODEL.md` the canonical memory/context model and align A008's existing implementation with it without replacing the working claim, state, lifecycle, persistence or retrieval architecture.

## Primary Deliverable

A bounded model-alignment change that preserves the useful two-layer architecture while ensuring:

1. resolved applicable claims can establish or advance Current State without `user-assertion-v1` being the universal state gate;
2. provenance/support remains queryable and usable for critical reasoning;
3. strength, severity, decay and activation remain retrieval-only semantics;
4. semantic associations support signed contextual attraction for broad/associative retrieval;
5. context build cleanly composes Current State, required evidence/history, adaptive memory and recent flow.

## In Scope

- Adopt `docs/CURRENT_MEMORY_MODEL.md` as the current normative owner for knowledge/state/memory/context semantics.
- Preserve A008-0143's one-open-HEAD binding, atomic history transition, explicit world-time handling, unresolved-claim protection and occurrence-based reinforcement.
- Preserve Evidence Claim as the durable ledger and SlotClaim as reconciliation shadow; neither competes with the open binding as current truth.
- Decouple `user-assertion-v1` from universal state admission. It remains useful provenance/assertion evidence, but attribution alone must not decide whether a resolved claim may own HEAD.
- Allow resolved applicable knowledge from user assertions, direct source observations, deterministic tool observations and assistant-derived observations/inferences to participate in state reconciliation while preserving their distinct provenance.
- Keep questions, quotations, hypotheticals, future-only claims and unresolved propositions from incorrectly becoming present Current State.
- Preserve source/provenance/support so later context can surface contradiction, direct observation and independent corroboration when reasoning needs them.
- Keep support and salience separate: source quality or corroboration may inform reasoning/context, while strength/severity/frequency/decay never vote on truth.
- Align context build with the staged retrieval model in `CURRENT_MEMORY_MODEL.md`: exact semantic state first, then scope/entity/tag/domain/association candidates, fuzzy expansion, evidence/history expansion, lifecycle ranking and bounded admission.
- Extend semantic-association retrieval metadata with signed `attraction` in `[-1, +1]` while preserving existing association identity, scope and occurrence receipts.
- Define positive attraction as contextual draw and negative attraction as contextual repulsion for broad/associative ranking only.
- Attraction must decay toward `0` (neutral), never toward negative values merely because time passes.
- Absence of co-occurrence must not create negative attraction; negative updates require an actual negative retrieval signal such as explicit semantic separation/opposition or a bounded relevant-candidate rejection signal.
- Relationship semantic valence and retrieval attraction remain independent: e.g. `dislikes` may still carry strong positive attraction because the related entity is contextually relevant.
- Exact/direct/current-state lookup must ignore attraction thresholds or repulsion.
- The same `occurrence × association` may update attraction at most once.
- Expose enough read-only inspection data to verify attraction/support/state behavior if current inspection cannot prove the required gates.

## Out of Scope

- Replacing SQLite or introducing another storage engine.
- Replacing the claim/evidence ledger, state binding model, relation classifier or existing lifecycle subsystem wholesale.
- ACME/provider execution ownership changes.
- A global fact-checker, global truth probability, or one composite confidence score that merges truth, support and salience.
- Treating source type alone as a permanent truth hierarchy.
- Automatic negative attraction from simple non-use or missing co-occurrence.
- Converting negative world-relation meaning into negative attraction.
- GUI redesign beyond the smallest diagnostic exposure required to inspect implemented semantics.
- Bulk destructive repair of existing stores unless a separate reviewed migration is proven necessary.
- Stage 5 client API work or unrelated product features.

## Definition of Done

- On an empty store, a resolved direct observation such as `ND-0001.status = In Progress` creates one current binding while retaining its claim and source provenance.
- A later applicable claim for the same address atomically closes the prior binding to history and becomes the sole HEAD.
- A first user assertion such as `moon.composition = cheese` can establish Current State while remaining explicitly attributed to the user rather than being treated as externally verified fact.
- A source/tool observation, user statement and assistant inference remain distinguishable in provenance even when any of them owns HEAD.
- Unresolved free text remains claim/evidence only and cannot create synthetic `statement_<hash>.statement` truth.
- Explicit historical/future qualifiers preserve their intervals and do not replace unrelated present HEAD.
- Strength, severity, active/dormant state, recurrence count and attraction cannot change which value is HEAD.
- Positive attraction measurably raises a relevant associative candidate's rank/eligibility; negative attraction measurably lowers it.
- Exact/direct lookup returns the correct Current State even under strongly negative attraction or dormant lifecycle state.
- Attraction decays toward zero and never becomes negative solely through decay.
- A semantically negative truth relation can retain positive attraction when repeated retrieval shows contextual relevance.
- Candidate discovery alone does not reinforce knowledge or attraction; admitted/actual use follows the exactly-once occurrence rule.
- Context construction can include current truth plus required contradictory/supporting evidence without presenting historical/evidence claims as parallel current truth.
- Existing A008-0143 atomic-state and reinforcement regressions remain green except where this charter explicitly supersedes the old admission gate.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `cd01db4`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Align claim→state ownership with the owner model | PC-04; owner-approved `CURRENT_MEMORY_MODEL.md`; A008-0143 smoke evidence | Resolved source/tool/assistant knowledge can remain permanently outside Current State solely because it was not a verified user assertion | Remove acceptance-as-universal-state-gate while reusing existing semantic address, temporal reconcile and binding machinery | empty-store source observation, user assertion, assistant inference and later-HEAD regressions |
| Preserve evidence/support in reasoning context | PC-03/PC-04; owner direction that source and independent evidence remain valuable | A later broad assertion can hide earlier direct evidence or the model can trust it blindly without seeing relevant contradiction | Reuse claim/provenance surfaces and add only the context-selection rules needed for contradiction/support expansion | conflicting user/source/tool context fixture with one HEAD and explicit evidence |
| Add contextual attraction to association retrieval | PC-02/PC-04; ADR 0035 P6 association ownership; owner direction 2026-09-20 | Related knowledge has only unsigned salience and cannot express contextual draw versus bounded repulsion | Extend the existing association lifecycle/ranking path with signed attraction and neutral decay; do not create a second graph | positive/negative ranking, exact bypass, decay-to-zero and dislikes-with-positive-attraction tests |
| Establish one current model authority | PC-04; docs-first owner direction 2026-09-20 | Old ADR/model wording can continue overriding the actual owner model and reintroduce stale gates | Make `CURRENT_MEMORY_MODEL.md` canonical and mark conflicting older clauses as superseded/history | documentation authority review and stale-reference search |

### Minimum Verification Gates

- [ ] Focused current-state tests for first HEAD, supersession/history, historical/future intervals and unresolved propositions.
- [ ] Live post-output tests for user, source/tool and assistant-derived resolved claims.
- [ ] Evidence/provenance tests proving source distinctions survive state reconciliation and can be selected into context.
- [ ] Existing A008-0143 reinforcement tests including exactly-once occurrence behavior and span-independent reinforcement.
- [ ] Attraction tests for positive draw, negative repulsion, exact/direct bypass, neutral decay and independent world-relation valence.
- [ ] SQLite persistence/restart parity for every changed durable field or association behavior.
- [ ] Context-build tests proving one Current HEAD plus bounded evidence/history/adaptive-memory composition.
- [ ] `npm run typecheck`.
- [ ] Affected core/memory suites and full repository tests, or exact named omissions with reasons.
- [ ] `git diff --check` and final scope/necessity review.

## References

- `docs/CURRENT_MEMORY_MODEL.md` — current owner-approved target.
- `docs/PROJECT_BRIEF.md` PC-02, PC-03 and PC-04.
- `docs/KNOWLEDGE_MEMORY_MODEL.md` — prior model; historical where superseded.
- `docs/adr/0018-knowledge-and-memory-model.md`.
- `docs/adr/0035-frozen-instruction-and-memory-target.md`.
- `docs/tasks/A008-0143_atomic-knowledge-state-ownership.md`.
- `src/memory/knowledge/`.
- `src/orchestration/relation-gated-memory-commit.ts`.
- `src/orchestration/post-output-knowledge-intake.ts`.
- Existing association lifecycle, retrieval and inspection code.

## Checklist

- [ ] Enumerate every implementation/document contradiction against `CURRENT_MEMORY_MODEL.md` before editing runtime code.
- [ ] Import/reuse the A008-0143 implementation changes as predecessor work; do not merge PR #83 standalone.
- [ ] Add failing first-HEAD tests for source/tool/assistant-derived resolved claims.
- [ ] Remove the residual `user-assertion-v1` universal state gate without removing its provenance value.
- [ ] Verify temporal/state ownership remains atomic and single-HEAD.
- [ ] Preserve unresolved claims without synthetic statement-state.
- [ ] Add contradiction/support-aware context selection without creating a truth score.
- [ ] Extend existing semantic associations with signed attraction and neutral decay.
- [ ] Verify lifecycle strength and attraction remain retrieval-only axes.
- [ ] Run focused, persistence, context-build, typecheck and full-suite gates.
- [ ] Reconcile older authoritative docs/ADRs so stale semantics are explicitly superseded.
- [ ] Update observed-status docs only after behavior is verified.

## Decisions and Notes

- The two-layer architecture is retained intentionally: claims/evidence are the durable ledger; Current State is the materialized HEAD projection.
- A008-0143 is superseded before merge because its prevention fix is useful but its remaining state-admission boundary is too narrow. Its code/tests are predecessor input, not discarded work.
- `user-assertion-v1` remains meaningful evidence that a user explicitly asserted a claim; it is no longer the universal definition of what may become Current State.
- Source/provenance affects epistemic reasoning and verification decisions. It is not memory strength and must not be collapsed into retrieval salience.
- Memory classification, severity, decay, strength, activation and reinforcement exist for retrieval behavior, not truth ownership.
- Attraction is contextual gravity, not confidence and not relationship valence.
- Direct/exact retrieval remains authoritative even when strength is dormant or attraction is negative.
- No new truth store, evidence score, graph implementation or generalized policy framework is authorized unless a failing gate proves it necessary.

## Charter Amendment Log

- none

## Verification

- [ ] Record exact focused and full-suite commands/results.
- [ ] Record all superseded model/ADR clauses and their replacement owner.
- [ ] Record persistence compatibility and any deferred migration.
- [ ] Record live smoke evidence for first-HEAD creation and context retrieval.

## Documentation Updates

- [ ] `docs/CURRENT_MEMORY_MODEL.md`
- [ ] `docs/KNOWLEDGE_MEMORY_MODEL.md`
- [ ] affected ADR(s), explicitly marking superseded clauses rather than silently editing history
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/FILESTRUCTURE.md` if the new current model file becomes a documented control-plane surface
- [ ] `docs/JOURNAL.md` on merge

## Handoff and Follow-ups

- Current state: Ready and frozen after owner review.
- Predecessor: A008-0143 / PR #83 is superseded and must not merge standalone; reuse its implementation/tests as the starting point.
- Next recommended step: create the A008-0144 successor worktree from the 0143 implementation lineage plus current main control-plane commits, then reproduce the first-HEAD admission failure before changing runtime code.
- Blockers: none known.
- Child tasks: none at freeze.
- Open questions: existing stores containing legacy synthetic state or state omitted by the old admission gate may require a separately reviewed migration after prevention and forward semantics are verified.

## Finalize When Complete

- Archive under `docs/finished/A008-0144_canonical-memory-model-contextual-attraction.md`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from `docs/template_CURRENT_TASK.md`.
- Write `docs/handoffs/A008-0144.md`.
- Push/open PR; do not merge from a worker.
