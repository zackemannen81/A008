# Current Task

Task ID: A008-0096
Parent Task: None
Status: Ready
Owner: mrWhite, A008 (operator)
Created: 2026-09-11
Last updated: 2026-09-11
Charter frozen at: 2026-09-11

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/adr/0024-retrieval-scope.md`
- `docs/adr/0025-memory-inspection-gui.md`

## Task Summary

Harden the existing live dialogue memory write and inspection paths without redesigning the memory engine. The observed failures are semantic-boundary defects around speech acts, attribution/certainty, entity labels, canonical claim structure, write-side domain accumulation, and duplicate inspection edges. The accepted memory model, namespaces, provenance, lifecycle, retrieval architecture, and SQLite layout remain the baseline.

## Task Charter

### Goal

Make stored and inspected dialogue-derived knowledge truthfully represent what the user asserted, requested, and what the system actually has evidence to accept, while preserving the existing memory architecture.

### Primary Deliverable

Deterministic policy/validation/commit/inspection hardening plus regression tests that prevent incorrect current-state acceptance, attribution, entity-label contamination, unnecessary statement-slot collapse, domain over-tagging, and duplicate graph edges.

### In Scope

- Classify imperative/request/desired-state dialogue so it cannot be treated as a normal user assertion merely because the extractor returns matching text.
- Ensure request/desired-state proposals cannot be accepted as current world state without separate supporting evidence or observation.
- Prevent answer-only paraphrases from being attributed to the user, and stop hardcoding `certainty = certain` where the source/evidence does not support it.
- Preserve `user-assertion-v1` as an identified acceptance policy while strengthening the deterministic guards around when it is eligible.
- Stop copying a full proposition into entity labels; entity labels remain names, aliases, identifiers, or lexical variants rather than claims.
- Preserve valid structured claim information when the existing ontology can represent it; keep `attribute = "statement"` as an explicit unstructured fallback, not the default collapse for every dialogue claim.
- Bound write-side domain aggregation using existing stored fields so an utterance does not become tagged with nearly every proposal domain in the turn. Do not add persisted `relatedDomains` or a new storage schema in this task.
- Remove duplicate logical edges from the memory inspection graph projection while preserving the stored dual provenance representation and provenance nodes.
- Adjust analyzer/extractor prompt wording only where deterministic validation needs clearer upstream input; prompt quality is a complement, not the enforcement boundary.
- Add regression coverage for each observed defect before or with the corresponding fix.

### Out of Scope

- Replacing or upgrading the extractor/model/provider as the solution.
- A global ontology redesign, new canonical record families, or SQLite schema migration.
- Backfilling or rewriting already persisted malformed/over-broad historical records.
- Redesigning retrieval, `current_scope`, association depth, ranking, lifecycle, decay, reinforcement, or namespace behavior.
- Automatic resolution of contested slots.
- Project bootstrap baseline commits.
- Model-handoff checkpoints.
- Failure/correction lesson memory.
- Filesystem/path verification for stored locators.
- Broader GUI redesign beyond inspection-edge deduplication required by this charter.

### Definition of Done

- A request such as `lägg in vfx, ljud och lite nice clean musik` cannot, from the request alone, become an accepted user-attributed current-state fact such as `The upgraded file includes ...`.
- Answer-derived or answer-only claims are not falsely attributed to the user and are not marked certain solely because they came through the dialogue commit path.
- Non-assertive speech acts are rejected by the user-assertion acceptance path unless separate evidence establishes the factual state.
- Entity labels no longer include the full proposition merely because a claim references the entity.
- Valid structured claims survive staging/commit without unnecessary collapse into `attribute = "statement"`; unstructured statement fallback remains supported.
- Write-side domain aggregation is deterministically bounded and existing retrieval-scope semantics remain unchanged.
- Memory inspection renders each logical claim/utterance relationship once while keeping provenance records inspectable and queryable.
- No SQLite schema migration, global ontology rewrite, or extractor-model swap is introduced.
- Focused regressions, `npm run typecheck`, and the repository test suite pass.
- Owning documentation, immutable archive, and handoff are produced before completion.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `f4e5238bbeb21e61f9a7d989ae2b3577ea1e7d29`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Guard request/desired-state acceptance, attribution and certainty | PC-04 — durable knowledge with runtime authority; ADR 0018 D4-D5: proposals are not canonical state, ACCEPT alone sets claim status, and `user-assertion-v1` is an acceptance policy rather than a truth shortcut | Instructions and answer paraphrases can otherwise become user-attributed, certain, accepted facts, making durable state claim outcomes the user never asserted or that were never observed | Harden speech-act classification plus acceptance/commit validation so non-assertive source text cannot enter the user-assertion path; derive attribution/certainty from supported source/evidence instead of hardcoded defaults | Regression from the observed music/request case, answer-paraphrase case, and focused acceptance/commit tests |
| Keep entity labels and canonical claim structure semantically distinct | PC-04; ADR 0018 D1/D4/D13: the accepted knowledge model owns meaning, INTERPRET proposes structure, and statement slots are sets rather than a substitute for semantic identity | Full propositions become aliases and structured facts collapse to opaque sentences, degrading identity, conflict handling, supersession and retrieval | Remove proposition text from entity-label construction; validate label hygiene; preserve existing structured proposal fields when valid; use unstructured statement only as fallback | Entity-label regression plus structured-claim round-trip/commit tests and existing knowledge-model scenarios |
| Bound write-side domain accumulation | PC-02 — contextual retrieval; ADR 0024 D1-D5: domains are the discussion-level retrieval boundary while fine-grained tags and related signals serve different roles | A multi-proposal turn can label one utterance with nearly every domain, causing domain matching to stop discriminating and widening future retrieval unnecessarily | Bound aggregation of proposal domains onto stored dialogue records using existing fields; keep read-side `relatedDomains` semantics unchanged and add no new persisted schema | Write-path/domain-label regression plus existing current-scope/retrieval tests |
| Deduplicate memory inspection edges without changing provenance storage | PC-06 — supported memory inspection; ADR 0025: graph edges describe stored structural/provenance links and inspection is read-only | The same logical claim→utterance relationship can be drawn multiple times from `Claim.derivedFrom` and provenance projection, making the diagnostic view misleading/noisy | Preserve both stored representations and provenance nodes; suppress only duplicate logical direct edges in the inspection projection | Memory-inspection regression proving one logical edge is rendered while provenance remains present |

### Minimum Verification Gates

- [ ] Add focused regressions for speech-act / request acceptance, source attribution and certainty.
- [ ] Add focused regressions for entity-label hygiene and structured-vs-statement claim commit.
- [ ] Add focused regression for bounded write-side domain aggregation and keep current-scope/retrieval tests green.
- [ ] Add memory-inspection regression for duplicate-edge suppression with provenance preserved.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes, or any skipped suite is named with a concrete reason and no affected gate is skipped.
- [ ] Review final diff against every necessity row and remove/reroute unrelated behavior.

## References

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- `docs/KNOWLEDGE_MODEL_GAP_ANALYSIS.md`
- `docs/adr/0018-knowledge-and-memory-model.md`
- `docs/adr/0024-retrieval-scope.md`
- `docs/adr/0025-memory-inspection-gui.md`
- Task identity claim `A008-0096` in `docs/TASK_IDS.md`
- Baseline main revision `f4e5238bbeb21e61f9a7d989ae2b3577ea1e7d29`

## Checklist

- [ ] Re-read governance, accepted model/ADR constraints, and current implementation before editing.
- [ ] Reproduce each slice-2 defect with deterministic tests/fixtures.
- [ ] Harden speech-act classification and the user-assertion acceptance boundary.
- [ ] Correct source attribution and certainty handling for dialogue-derived proposals.
- [ ] Remove proposition contamination from entity labels and add label validation.
- [ ] Preserve valid existing structured claims; retain statement as unstructured fallback only.
- [ ] Bound write-side domain aggregation without changing read-side retrieval semantics or storage schema.
- [ ] Deduplicate inspection graph edges without removing provenance records/nodes.
- [ ] Run focused verification, typecheck, and full repository tests.
- [ ] Update owning docs only where behavior actually changed.
- [ ] Recheck necessity and frozen scope against the final diff.
- [ ] Archive the completed task, write handoff, restore `docs/CURRENT_TASK.md` from the template, push, and open PR; do not merge.

## Decisions and Notes

- Policy/validator boundaries are authoritative. Prompt changes may reduce bad proposals but must not be the only protection.
- The task must remain model-independent: a weaker extractor is allowed to propose bad semantics without those semantics becoming accepted canonical state.
- Existing memory architecture is the baseline. Do not introduce a parallel memory path or new persistence model.
- `attribute = "statement"` remains legal for genuinely unstructured free text.
- Stored provenance is intentionally dual: canonical record fields plus queryable provenance records. This task deduplicates inspection projection only.
- Existing persisted bad records are not migrated or rewritten in this task.
- Any discovered change outside the frozen charter follows `docs/TASK_WORKFLOW.md`: checklist if already required, bounded child if blocking, backlog if useful later, concepts sandbox if outside direction.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record focused regression commands and exact results.
- [ ] Record `npm run typecheck` result.
- [ ] Record `npm test` result or explicit justified omissions.
- [ ] Record any prompt change and the deterministic validator/policy that makes it non-critical.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md` if observed current behavior changes materially.
- [ ] `docs/SYSTEMDOC.md` for durable implemented behavior.
- [ ] `docs/JOURNAL.md` (operator-owned on merge).
- [ ] `docs/FILESTRUCTURE.md` only if repository structure changes.
- [ ] ADR/index updates only if the implementation requires a durable decision beyond the already accepted constraints; otherwise do not create one.

## Handoff and Follow-ups

- Current state: Ready; task ID claimed on `main`, implementation not started by this charter commit.
- Next recommended step: Work on branch `a008/A008-0096`, reproduce defects first, then implement the smallest deterministic hardening in the order listed.
- Blockers: None known at charter freeze.
- Child tasks: None at charter freeze.
- Resume condition: Revalidate the contract and charter if the task is paused or `main` changes materially before implementation continues.
- Open questions: Exact write-side domain aggregation cap/selection may be refined inside this frozen outcome using tests and observed current behavior, but must not add new persisted schema or change read-side `relatedDomains` semantics.

## Finalize When Complete

- Archive this task under `docs/finished/A008-0096_memory-semantic-hardening.md` with `Status: Complete`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from `docs/template_CURRENT_TASK.md` before the last commit and push.
- Write `docs/handoffs/A008-0096.md`.
- Push and open a pull request. Do not merge.
- The operator appends the signed `docs/JOURNAL.md` entry on merge to `main`.
