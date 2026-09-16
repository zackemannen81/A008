# A008-0121 — extractor hardening

Task ID: A008-0121
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-16
Last updated: 2026-09-17
Charter frozen at: 2026-09-16

## Task Summary

Harden the post-output knowledge analyzer so durable knowledge remains complete after qualification while transient execution narration and generic entity labels do not pollute persistent memory.

## Task Charter

### Goal

Improve proposal precision at the analyzer boundary without changing A008 memory, lifecycle, relation, retrieval, or persistence semantics.

### Primary Deliverable

A stricter `POST_OUTPUT_KNOWLEDGE_ANALYZER_INSTRUCTION` with explicit durability eligibility, assistant-answer handling, entity identity hygiene, and occurrence-vs-pattern rules, plus focused contract regressions.

### In Scope

- Rewrite only the post-output analyzer instruction under `src/prompt-contracts/`.
- Preserve the existing JSON field contract, structured proposition shapes, severity, confidence, and exact source-support rules.
- Keep the current fictional `analysisExamples` unchanged for the first comparison run.
- Add focused prompt-contract assertions for the new eligibility and entity rules.
- Run existing example/staging regressions and offline build/type verification.
### Out of Scope

- Relation classifier or batch-classifier behavior.
- Retrieval scope/classification or domain inheritance in the memory map.
- Runtime commit gates, canonical reconciliation, lifecycle, decay, reinforcement, schema, or persistence changes.
- Importing or adopting Graphiti code or ontology.
- Rewriting the fictional examples before the first prompt-only comparison.

### Definition of Done

- Eligibility is decided before completeness, with precision preferred at the durability boundary.
- Routine tool/workflow narration and temporary execution state are explicitly excluded.
- Assistant-only durable discoveries remain eligible under a higher threshold.
- Entities must be stable independently identifiable referents; generic concepts/actions are rejected as entities.
- A single occurrence cannot become a habit, preference, trait, trend, or general pattern unless the source says so.
- Existing JSON/support/structured-proposition/severity contracts remain intact.
- Focused prompt/example tests, typecheck, build and `git diff --check` pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-04 — Durable knowledge with runtime authority.
Contract revision: `3532bcd8a0546e79dde1dbdb4e2623ca387ad0c6`.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Analyzer eligibility + entity hygiene | PC-04 requires post-turn durable proposals from original message/final answer; SYSTEMDOC keeps analyzer output untrusted and completeness limited to qualifying durable claims | Observed transient execution facts and generic entities become persistent proposal noise, degrading the knowledge bank without adding durable information | Change analyzer instruction only; preserve runtime-owned admission/reconciliation/lifecycle | Prompt-contract assertions + existing staged fictional examples + focused intake tests |
### Minimum Verification Gates

- [x] Analyzer prompt contract assertions pass.
- [x] Existing documented extractor examples still stage with exact source support.
- [x] Focused semantic JSON and post-output intake tests pass.
- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.
- [x] `git diff --check` passes.

## References

- `docs/PROJECT_BRIEF.md` PC-04.
- `docs/SYSTEMDOC.md` reasoning and post-output staging; stateless semantic JSON calls.
- `docs/finished/A008-0085_extraction-json-contract.md`.
- `docs/finished/A008-0120_refactoring-prompts.md`.

## Checklist

- [x] Claim A008-0121 on main.
- [x] Freeze this bounded charter from merged A008-0120 state.
- [x] Replace analyzer instruction with the reviewed first-draft hardening rules.
- [x] Add focused prompt-contract regression assertions without changing examples.
- [x] Run minimum verification gates.
- [x] Record results and route live-model quality findings separately.

## Decisions and Notes

- The first comparison deliberately leaves `analysis-examples.ts` unchanged so example bleed and prompt-rule effects can be distinguished.
- Graphiti and AudioLeaf informed review criteria only; no external source is imported or made authoritative.
- Live comparison showed the hardened analyzer materially reduced noisy proposals, but also exposed write-path and relation-contract defects outside this frozen prompt-only task.
- A current request or immediate work intention is explicitly not a durable preference unless the source establishes persistence beyond the request.

## Verification

- [x] Actual changes were reviewed against PC-04 and the frozen prompt-only scope.
- [x] `npm --prefix C:\code\a008 run test:core` — PASS, 637/637.
- [x] `npm --prefix C:\code\a008 run typecheck` — PASS.
- [x] `npm --prefix C:\code\a008 run build` — PASS.
- [x] `git -C C:\code\a008 diff --check` — PASS.
- [x] No live provider call was required for completion; owner-run live observations are recorded only as follow-up evidence.

## Documentation Updates

- [x] Task archive and handoff record the implemented analyzer contract and discovered follow-ups.
- [x] `docs/SYSTEMDOC.md` updated for the durable eligibility/entity-hygiene prompt behavior.
- [ ] `docs/JOURNAL.md` remains operator merge-time work.
- [x] `docs/FILESTRUCTURE.md` unchanged because repository structure did not change.

## Handoff and Follow-ups

- Current state: analyzer eligibility is stricter and prompt-contract regressions protect durability gating, current-request handling, entity hygiene, severity/support fields and one-off-pattern rules.
- Live follow-up 1 — entity identity/topology: `entities[]` denotes distinct referents, but the write path currently treats the first entry as statement owner and remaining entries as aliases; claims also lack deterministic structural claim↔entity connectivity.
- Live follow-up 2 — identity normalization: labels such as `React` and `react` must resolve to one canonical identity without discarding a preferred display label; old development stores may be discarded rather than migrated.
- Live follow-up 3 — relation input: current-batch new entities are not addressable during association classification; structured propositions should be evaluated as classifier input where available.
- Live follow-up 4 — relation prompts: batch and single classifiers must share self-contained relation/association semantics; the batch prompt must not refer to rules in an unseen single prompt.
- Live follow-up 5 — graph projection: preserve stored domains while deriving `effectiveDomains` and `primaryEffectiveDomain` from connected knowledge rather than mutating entity semantics.
- Live follow-up 6 — provenance: assistant-answer-only discoveries must not be attributed to the user utterance or user authority.
- Blockers: none.
- Recommended next task: one bounded memory-contract repair covering Identity, Topology, Relation Semantics and Projection/Provenance, with no legacy-store migration obligation.
