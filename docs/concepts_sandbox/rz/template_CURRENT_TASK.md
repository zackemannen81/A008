# Current Task

Task ID:
Parent Task: None
Status: Draft
Owner:
Created:
Last updated:
Charter frozen at:

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant ADRs under `docs/adr/`

## Task Summary
A task is never considered done until:
JOURNAL.md, SYSTEMDOC.md, CURRENT_STATUS.md is a jour.

Describe the task, why it is being done now and the intended outcome.

## Task Charter

The charter is editable while status is `Draft` and immutable once status is
`Ready`.

### Goal

Define one primary outcome.

### Primary Deliverable

Name the concrete artifact or behavior that completes the task.

### In Scope

- List work required for the primary deliverable.

### Out of Scope

- List adjacent work that must not be absorbed.

### Definition of Done

- Define objective, verifiable completion conditions.

### Minimum Verification Gates

- [ ] Define checks that may be strengthened but not removed after `Ready`.

## References

- Add relevant documents, code, decisions and external contracts.

## Checklist

- [ ] Break work into concrete, ordered steps.
- [ ] Keep this checklist aligned with actual progress.
- [ ] Add verification and documentation steps.

## Decisions and Notes
- A checkpoint after each step or substep is required. Checklist is therefore updated along the work and `CURRENT_STATUS.md` is always updated when changes affect the behavior.
- Record decisions and assumptions within the frozen charter.
- Classify discoveries using `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

Only non-semantic corrections are allowed after `Ready`.

-none

## Verification

- [ ] Define task-appropriate technical checks.
- [ ] Define manual or scenario validation when relevant.
- [ ] Document skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs when long-lived decisions change

## Handoff and Follow-ups

- Current state:
- Next recommended step:
- Blockers:
- Child tasks:
- Resume condition:
- Open questions:

## Finalize When Complete

- Archive this file under `docs/finished/`.
- Restore this template or populate the next approved task.
- Add a signed `docs/JOURNAL.md` entry.
- If Goal or Definition of Done changed, supersede this task instead of
  rewriting it.
