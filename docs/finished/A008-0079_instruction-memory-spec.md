# Current Task

Task ID: A008-0079
Parent Task: None
Status: Complete
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: Ready commit on codex/A008-0079-instruction-memory-spec

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- ADR 0018, 0023, 0024, 0027, 0028 and 0034

## Task Summary

The owner requests a clear implementation specification for a single chat
instruction plane, semantic severity, genuine-evidence reinforcement, lazy
exponential decay and independent relationship strength. The owner also requests
concrete policy defaults, explicitly proposed for decision. This task produces
decision input and bounded implementation requirements; it does not implement
the product or silently amend accepted knowledge semantics.

## Task Charter

### Goal

Make the supplied behavior precise enough to implement without scope drift,
while exposing policy choices and conflicts with existing A008 authority.

### Primary Deliverable

`docs/backlog/instruction-plane-and-memory-lifecycle.md`: one indexed,
stable specification with separate implementation slices and acceptance cases.

### In Scope

- Inspect current instruction, extraction, commit, lifecycle and persistence owners.
- Specify required behavior, preserved boundaries and explicit non-goals.
- Propose numeric defaults with calculated, reviewable consequences.
- Identify needed decision amendments, migration and provenance requirements.
- Map requirements to acceptance cases and bounded implementation slices.
- Update current status and file map; complete archive, handoff and journal.

### Out of Scope

- Product code, tests, schemas, dependencies, live settings or database changes.
- Accepting proposed defaults or amending the product contract/constitution.
- Retrieval/scope/ranking redesign, scaling indexes, background sweeps.
- Implementing any slice, paid/live calls, push, publication or release.
- Unrelated documentation repairs or private input publication.

### Definition of Done

- One self-contained English specification captures all supplied feature groups.
- Required behavior, recommendations and current observations are distinguished.
- Defaults include half-lives, thresholds, boosts, units and dormancy examples.
- Cases cover trust boundaries, no read reinforcement, target identity, retries,
  decay boundaries, persistence/migration and independent edges.
- Each implementation slice has authority, allowed owners, non-goals and gates.
- Decisions needed before affected implementation are explicit; prompt work
  does not depend on lifecycle policy decisions.
- Current reality is not described as implemented; archive/handoff are complete.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `6b84c11aa789f3acf72f5b98a02ed14d81618411`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Instruction requirements | PC-01 shared engine, PC-05 untrusted data, PC-06 controls; ADR 0027 global instructions and operation snapshots | Specify delivery of configured instructions without competing default/envelope messages; omission leaves the observed composition fault ambiguous | One proposed specification section and wire-level cases using existing owners | Compare captured-code path and specified global/empty/tool-round behavior; preservation checklist |
| Lifecycle decision input | PC-04 runtime authority and accepted knowledge model; ADR 0018 D1/D3-D7; workflow permits bounded research before direction decisions | Expose precise persistence/recurrence semantics and authority conflicts; omission permits reinforcement of assistant echoes or rewriting truth | Requirements and proposed policy/migration choices in the same spec; no runtime changes | Requirement coverage, hand calculations, evidence/edge separation and explicit adoption boundary |
| Continuity records | PC-01/PC-04 implementation continuity under workflow and ADR 0034 | Keep proposed behavior discoverable and distinguish it from current reality; omission would leave private chat as the only handoff | Existing index/status/map/task/handoff/journal owners | Relative links, fences, member status, frozen charter, unchanged historical/product files, template equality and diff check |

### Minimum Verification Gates

- [x] Review supplied requirements and exact source owners against the specification.
- [x] Calculate proposed half-life/dormancy/boost examples independently.
- [x] Review authority conflicts and all anti-drift acceptance cases.
- [x] Check changed Markdown references, fences, indexes and staged secret patterns.
- [x] Check frozen charter, existing immutable records, product-file preservation and template bytes.
- [x] Run git diff --check; record runtime/live checks as not performed.

## References

- Owner specification request, 2026-09-08, including explicit request for proposed defaults.
- Observed source revision: `d7c542811b9744e2c3f30a65564c6c50b2c4392b`.
- `docs/KNOWLEDGE_MEMORY_MODEL.md`
- `docs/adr/0034-product-contract-and-necessity-gate.md`

## Checklist

- [x] Read repository authority and inspect implementation owners.
- [x] Claim A008-0079 on local main before Ready (`a35b544`).
- [x] Write and review the bounded specification.
- [x] Calculate examples and verify documentation.
- [x] Update owning records, archive and hand off.
- [x] Restore CURRENT_TASK and prepare the operator's local integration handoff.

## Decisions and Notes

- Specification only. MUST statements describe the proposed implementation
  contract; current authority is not changed by documenting them.
- All input is restated without raw attachments or personal examples.
- Freeze revision: `b271be8`; user explicitly selected concrete proposed defaults.
- Migration review exposed legacy zero thresholds and unknown clocks; their
  treatment is explicit proposed decision input, not a runtime fallback.
- Identity claim is local and unpublished; reconcile shared main before a push.

## Charter Amendment Log

- none

## Verification

- Source/requirement review: all supplied groups are represented by 22 stable
  requirement groups and 30 future acceptance cases. Manual checks:
  - Instruction/default/envelope ownership and tool snapshots: IP-01–06, A01–08.
  - Scope/budget/additive retrieval preservation: B-01–04, A06–08/A21/A30.
  - Severity versus truth/confidence, raw-carrier scope: ML-01–02, A09/A11.
  - Lazy elapsed decay, pins, equality and clock boundaries: ML-03–06, A10–13/A19–21.
  - Genuine source, exact target, relation matrix, restart/retry: RF-01–04, A14–18/A29.
  - Edge identity and independence: RS-01–02, A25–29.
  - Settings/migration/unknown clocks/legacy threshold zero: P1–P6, A22–24.
  - Explicit adoption boundaries and independent L1 delivery: sections 9–12.
- Independent Python calculations using exp/log/log2: critical crossing
  847.503754634 days, important 180, minor 14, association 45. Minor at day 28
  is 0.10; boost 0.20 gives 0.30 and another 8.189475010 days to crossing.
  Approximate lambda table entries agree within 1e-8 relative tolerance.
- Ad hoc Python documentation review at specification completion: 7 changed
  Markdown files, 51 Markdown links, no broken paths/anchors or fence errors
  in those files. Backlog membership/status, sequential A01–A30, all 22
  requirement groups and preserved frozen charter passed. Closure records are
  checked again after template restoration.
- `git diff d7c5428 --check` and `git diff --cached --check`: passed.
  Product files and prior finished/handoff/ADR records are unchanged.
  Added-text credential-pattern scan: no matches.
- Necessity review: only the proposed specification and required continuity
  owners changed. No product authority, runtime policy or implementation was
  silently adopted. SYSTEMDOC remains truthful and unchanged.
- Skipped: product typecheck/build/unit/integration/migration/provider tests.
  This task contains no product code. A01–A30 are specified future gates,
  not executed runtime tests or evidence of model obedience.
- No live/paid calls, push or publication. Untracked `.grok/` was not read,
  changed or staged. Three earlier reference defects remain separately
  recorded in `docs/backlog/runtime-proof-reference-repair.md`; this task
  did not broaden into a global historical reference repair.

## Documentation Updates

- [x] CURRENT_STATUS, backlog index and FILESTRUCTURE.
- [x] SYSTEMDOC reviewed; no behavior changed, so no prospective runtime claims.
- [x] Archive and handoff prepared; the operator appends JOURNAL on integration.

## Handoff and Follow-ups

- Current state: complete proposed specification; runtime unchanged.
- Next recommended step: activate L1 with its own frozen implementation charter.
- Blockers: none for specification authoring.
- Child tasks: none.
- Resume condition: L1 can be chartered independently; adopt P1–P5 before L2 and P6 before L3.
- Open questions: P1–P6 are documented recommendations, not accepted policy.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore CURRENT_TASK from the unchanged template.
- Append a signed operator JOURNAL entry on local integration.