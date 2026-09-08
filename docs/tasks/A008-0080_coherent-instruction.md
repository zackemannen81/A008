# Current Task

Task ID: A008-0080
Parent Task: None
Status: Ready
Owner: Codex (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: Ready commit containing this charter

## Read First

- `AGENTS.md`, `docs/TASK_WORKFLOW.md`, `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`, `docs/CURRENT_STATUS.md`, `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`, `docs/FILESTRUCTURE.md`
- ADR 0027, 0028, 0034, 0035
- `docs/backlog/instruction-plane-and-memory-lifecycle.md`

## Task Summary

The owner reviewed the specification and authorized committing, publishing to
main, freezing it and starting implementation. The reviewed preparation is
published at `97f36eb`. This task records target adoption and implements only
L1. P1–P6 are accepted target decisions through ADR 0035; L2/L3 remain separate,
unactivated implementation slices.

## Task Charter

### Goal

Deliver one coherent system instruction for A008 chat through the shared owner,
without changing retrieval or memory lifecycle semantics.

### Primary Deliverable

L1 implementation satisfying IP-01–06 and preservation boundaries B-01–04 in
the owner-reviewed specification, with executed offline acceptance evidence.

### In Scope

- Freeze the reviewed normative specification body and record owner adoption.
- Core invocation assembly, session-base/default provenance, memory instruction
  component, runtime factories and CLI explicit --system propagation.
- Existing relevant core/session/runtime/CLI/provider/tool tests; membership.
- Accepted and current documentation, task records, remote-main integration.

### Out of Scope

- L2/L3 implementation, severity/lifecycle/policy settings, schema or migration.
- Retrieval/scope/filter/expansion/ranking/projection algorithm changes.
- New prompt framework, providers, dependencies, GUI redesign or scaling work.
- Live/paid provider calls, deployment, packaging changes or a versioned release.
- Existing untracked .grok content and unrelated historical repairs.

### Definition of Done

- Final chat wire contains one assembled system message; explicit session/global
  configuration appears once and generic fallback is used only when neither exists.
- Default provenance is preserved through both factories and CLI model changes;
  explicitly configured text equal to the fallback is not discarded.
- Applicable memory handling is integrated into that message with unchanged
  envelope serialization and no synthetic history or semantic-prompt leakage.
- Settings snapshots, tool rounds, original-message/final-answer intake and
  existing hard budgets keep their contracts.
- Offline A01–A08 evidence is mapped to actual tests, including existing
  retrieval preservation fixtures. Model obedience remains an unverified
  behavioral hypothesis without an authorized live-provider test.
- Source/runtime documentation is current; completed archive/handoff and journal
  exist; CURRENT_TASK is restored; completed work reaches remote main.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `97f36ebffe444858697a947260fc745af1ab8525`
Refining authority: owner-reviewed specification and ADR 0035

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Freeze and adoption | PC-01/04/06; ADR 0034, workflow; explicit owner review/start request | Give implementation one stable target; omission leaves Proposed labels and approved direction inconsistent | ADR 0035, fixed specification body hash, status/index and charter updates | Compare normative body with reviewed blob; index/status and source authority review |
| L1 composition | PC-01/05/06; ADR 0027 decisions 2/5/6; IP-01–06 | Global instructions and memory rule reach chat once; omission preserves competing messages and generic fallback | Shared core assembly of configured components plus contextual rule; defer fallback selection until explicit configuration is known; preserve CLI provenance | A01–05/A07–08 through core, runtime, CLI, provider and tool transport tests |
| Preserve context and history | PC-02/03/04; ADR 0023 D1–D4, 0024 D1–D6, 0028 tool exception; B-01–04 | Preserve existing knowledge and context behavior while changing instructions; omission risks silent pipeline or history drift | No memory-engine algorithm/storage edits; run existing scope/projection/intake/tool fixtures and check raw histories | A06–08, full core and membership suites, GUI/engine coverage, source diff boundary review |

### Minimum Verification Gates

- [ ] Verify frozen specification body and final diff necessity/scope.
- [ ] Typecheck and build; targeted instruction/core/runtime/CLI/tool tests.
- [ ] Full core suite and suite-membership checks; supported GUI tests.
- [ ] A01–A08 evidence table with honest behavioral/live-test limitations.
- [ ] Documentation links/fences/indexes, credential-pattern and diff checks.
- [ ] Preserve prior immutable records; restore CURRENT_TASK; verify remote main.

## References

- Reviewed specification commit `97f36eb`, blob `7371a86ddcc1b82f8bf3d96add40e5dfda928f3f`.
- Normative-body SHA-256 `a7f32b601a6d26cceeaaad3cf6b45f362c97d9b04bb5b5286c0fbfaa57c56a5a`.
- Identity claim `2f2275c`, committed and published on main before Ready.

## Checklist

- [x] Publish reviewed preparation to remote main and verify matching SHA.
- [x] Claim A008-0080 on shared main.
- [ ] Record/freeze owner adoption and publish the Ready charter.
- [ ] Implement L1 inside the frozen scope.
- [ ] Execute checks and update owning documents.
- [ ] Archive, restore template, integrate/push and journal.

## Decisions and Notes

- CLI parsing currently injects the generic text before runtime composition.
  It must preserve absence of explicit --system through model changes; updating
  the runtime factories alone cannot satisfy A01/A02 on the CLI.
- Internal instruction components are permitted; final wire assembly has one owner.
- Runtime policy defaults and knowledge implementation remain unchanged in L1.

## Charter Amendment Log

- none

## Verification

- Pending.

## Documentation Updates

- ADR 0035, specification status/index, PROJECT_BRIEF, CURRENT_STATUS and FILESTRUCTURE.
- SYSTEMDOC and runtime settings describe actual L1 behavior at completion.
- Archive, handoff, task status and operator journal.

## Handoff and Follow-ups

- Current state: Ready for L1; reviewed target accepted and frozen.
- Next step: implement/test L1.
- Blockers: none.
- Child tasks: none; L2/L3 require their own activation.
- Open questions: live behavioral obedience is not established by offline tests.
