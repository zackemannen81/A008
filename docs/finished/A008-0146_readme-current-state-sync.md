# A008-0146 — README current-state synchronization after Stage 4 closure

Task ID: A008-0146
Parent Task: None
Status: Complete
Owner: Rickard (operator)
Created: 2026-09-20
Charter frozen at: 2026-09-20
Completed: 2026-09-20

## Summary

Synchronize the public README with the verified post-Stage-4 repository state without changing product behavior or starting Stage 5.

## Frozen Charter

### Goal

Make the README accurately state the stable-client program status and recent user-visible behavior.

### Primary Deliverable

A focused `README.md` current-state correction.

### In Scope

- Correct Stage 5 wording to remain Not started while identifying it as the next program gate.
- Replace the obsolete README verification baseline with the latest documented complete suite result.
- Add concise README coverage of A008-0142 ordered generated-image content and A008-0145 explicit chat/semantic model controls.
- Archive the completed charter, write a handoff, restore the current-task template and append the operator journal entry.

### Out of Scope

- Any Stage-5 SDK or bundled-web-client migration.
- Runtime, protocol, test, dependency, API or configuration changes.
- Changes to `CURRENT_STATUS.md`, `SYSTEMDOC.md` or `FILESTRUCTURE.md` when their current statements already own the accurate detail.

### Definition of Done

- README statements agree with `CURRENT_STATUS.md` and the A008-0103 program record.
- No product behavior changes.
- Required docs-first completion records exist and `CURRENT_TASK.md` is restored to the template.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `9a7a8eb`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| README state synchronization | PC-01 one shared engine and PC-06 supported user controls/content; ADR 0034 permits concise documentation repairs | Public entry-point users need accurate supported-client/multimodal/control state; stale Stage-5 wording, verification evidence and omitted current capabilities misrepresent the product | Edit only the affected README state, feature and verification paragraphs | Compare against `CURRENT_STATUS.md` and A008-0103; validate Markdown links and diff hygiene |

### Minimum Verification Gates

- [x] Review README claims against `docs/CURRENT_STATUS.md` and the A008-0103 program record.
- [x] Check local Markdown links, fenced code blocks and `git diff --check`.
- [x] Confirm no product source, schema or generated artifact changed.

## References

- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/tasks/A008-0103_stable-client-api-program.md`
- `docs/adr/0034-product-contract-and-necessity-gate.md`
- `docs/finished/A008-0142_UX-image-generating-improvements.md`

## Completed Checklist

- [x] Claim A008-0146 on `main` in commit `9a7a8eb`.
- [x] Freeze the docs-only charter and necessity argument.
- [x] Update the bounded README statements.
- [x] Perform documentation verification and review scope.
- [x] Archive the task, write the handoff, restore the template and append the journal.

## Decisions and Notes

- The latest complete full-suite count documented by A008-0142 is 701 core + 4 membership + 186 GUI = 891. A008-0145's recorded run does not supersede that complete baseline.
- Stage 5 remains Not started in the program record. This task did not characterize it as active and did not start or charter the Stage-5 implementation.

## Charter Amendment Log

- none

## Verification

- README claims were compared with `docs/CURRENT_STATUS.md` and `docs/tasks/A008-0103_stable-client-api-program.md`.
- The README now states Stage 5 is the next programme gate and Not started until a child charter is frozen.
- The README verification baseline now matches the documented A008-0142 complete suite: 701 core + 4 membership + 186 GUI = 891, zero failures/skips.
- Documentation checks: local Markdown-link scan, fenced-code-block balance and `git diff --check` passed.
- `git diff --name-only` confirmed the implementation change is documentation-only. Runtime tests/builds were not rerun because no product source, schema, dependency or generated artifact changed.

## Documentation Updates

- [x] `README.md`
- [x] `docs/CURRENT_STATUS.md` — reviewed; no change needed.
- [x] `docs/SYSTEMDOC.md` — reviewed; no change needed.
- [x] `docs/JOURNAL.md`
- [x] `docs/FILESTRUCTURE.md` — reviewed; no structural change.
- [x] Archive and handoff created.

## Handoff and Follow-ups

- Current state: README is synchronized with the post-Stage-4 state; A008-0103 remains In Progress.
- Next recommended step: When authorized, claim and freeze a bounded Stage-5 SDK + web-migration child charter.
- Blockers: None.
- Child tasks: None.
- Resume condition: N/A.
- Open questions: None.
