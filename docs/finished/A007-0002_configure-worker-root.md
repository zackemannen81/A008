# Current Task

Task ID: A007-0002
Parent Task: None
Status: Complete
Owner: mrWhite81 and felixnissen
Created: 2026-09-01
Last updated: 2026-09-01
Charter frozen at: 2026-09-01 after claim commit `e7f7604` and direct owner designation

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/MULTIAGENT.md`

## Task Summary

Register the owner-created `C:\code\a007-workers` directory as a007's durable
multi-agent worker-clone root so future writing waves do not depend on chat
history for clone placement.

## Task Charter

### Goal

Configure one verified external root for isolated worker clones.

### Primary Deliverable

Updated repository authority naming `C:\code\a007-workers` as the worker-clone
root with safe naming and preflight rules.

### In Scope

- Verify the path exists, resolves outside `C:\code\a007`, and inspect its
  current contents.
- Record the path and clone naming convention in multi-agent policy.
- Update current status, implemented system description, entry guardrails, and
  file map.
- Verify documentation and archive this task.

### Out of Scope

- Creating, deleting, or synchronizing worker clones.
- Launching agents or installing the optional MCP process layer.
- Activating product implementation tasks.
- Push, deployment, publication, or other external effects.

### Definition of Done

- The worker-root path is stated consistently in owning documents.
- Policy prevents shared writing directories and clone placement inside the
  canonical repository.
- Current status truthfully states that no worker clone or process enforcement
  exists yet.
- Documentation checks pass and A007-0002 is archived.

### Minimum Verification Gates

- [x] Resolve both canonical and worker-root paths and prove they are distinct
  sibling locations.
- [x] Confirm the worker root exists and record its observed contents.
- [x] Relative Markdown links, fences, and collection indexes pass.
- [x] `git diff --cached --check` passes.
- [x] No worker clone or external process is created.

## References

- `docs/MULTIAGENT.md`
- `docs/CURRENT_STATUS.md`
- Owner message designating `C:\code\a007-workers`

## Checklist

- [x] Claim A007-0002 on `main`.
- [x] Verify the external directory read-only.
- [x] Update multi-agent and current-truth documents.
- [x] Run verification and record skipped actions.
- [x] Append journal, archive task, and restore the active template.

## Decisions and Notes

- Default worker directory name: `A007-NNNN_task-slug`.
- Default worker branch name: `codex/a007-nnnn-task-slug` unless a charter names
  another branch.
- The directory was empty when registered; emptiness is an observation, not a
  permanent invariant.

## Charter Amendment Log

- none

## Verification

- [x] Resolved `C:\code\a007` and `C:\code\a007-workers`; paths were unequal
  and the worker root was not inside the canonical root.
- [x] Worker root existed with zero child items at verification.
- [x] All 26 tracked Markdown files had resolving relative links and balanced
  fences; every index-mode collection listed its members.
- [x] `git diff --cached --check` passed.
- [x] Skipped clone creation, process launch, MCP installation, and write-
  permission probing because this task only records the owner-provided root.

## Documentation Updates

- [x] `AGENTS.md`
- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/MULTIAGENT.md`
- [x] `docs/FILESTRUCTURE.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: Worker-root configuration complete; no clone was created.
- Next recommended step: use the registered root only after child IDs and
  non-overlapping charters are Ready.
- Blockers: none.
- Child tasks: none.
- Resume condition: not applicable.
- Open questions: process-layer installation remains a backlog proposal.

## Finalize When Complete

- Archive under `docs/finished/A007-0002_configure-worker-root.md`.
- Restore `docs/CURRENT_TASK.md` from the clean template.
- Append a signed journal entry.
