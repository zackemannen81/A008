# Current Task

Task ID:
Parent Task: None
Status: In Progress
Owner: Rickard
Created: 2026-09-26
Last updated: 2026-09-26
Charter frozen at: 2026-09-26

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- Relevant accepted top-level records under `docs/adr/`; never use `docs/adr/_legacy/` as current authority

## Task Summary

Complete the multi-project / multi-conversation execution model so that A008 is no longer conceptually bound to one active project, one active workspace or one foreground client session.

A008 must support:
- multiple registered projects at the same time;
- multiple independent conversations within each project;
- one isolated Git worktree per writable conversation;
- multiple simultaneously running conversations and runs;
- background execution that continues when the originating UI window disconnects, switches project or closes;
- multiple A008 clients/windows observing and controlling the same durable host state without becoming execution owners.
- Changes must be usable in the web-gui (/gui)this may require 1. either migrating the involved parts from v1 or adding support for this in v1.

The durable ownership chain shall be explicit:

Project
  → Conversation
    → Workspace
      → Run

A project owns shared runtime identity and semantic memory.
A conversation owns its selected workspace.
A run executes against the workspace bound to its conversation.
A client/UI observes and controls these durable resources but does not own their lifetime.


## Task Charter

### Goal

Define one primary outcome.

### Primary Deliverable

Name the concrete artifact or behavior.

### In Scope

- List work required for the deliverable.

### Out of Scope

- List adjacent work that must not be absorbed.

### Definition of Done

- State objective completion conditions.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: <Git commit containing the reviewed contract>

One row per coherent change or group serving one outcome. Apply the Necessity
Gate in `docs/TASK_WORKFLOW.md`; results belong in Verification. References,
intended outcomes and planned checks freeze with the charter. Record refinements
of the initial approach in mutable notes within those bounds.

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| <coherent change> | <exact reference> | <enable / fix / protect / verify; concrete consequence> | <bounded approach> | <test or named review> |

### Minimum Verification Gates

- [ ] Define checks that may be strengthened but not removed after Ready.

### Verification Budget

Resolve before live dispatch using [Live verification budget](TASK_WORKFLOW.md#live-verification-budget).
Inheritance authorizes in-scope calls without per-call approval; record the
policy revision and effective numeric ceilings. Use not-needed/zero for tasks
that do not require live verification. Credentials are references only.
Budget is a ceiling, not a target: stop once the verification need is satisfied.

- Live verification purpose / required provider behavior:
- Budget owner / parent allocation:
- Policy revision / inherited or explicit approved limits:
- max_live_verification_cost (amount + currency):
- max_live_verification_calls (all physical attempts):
- max_input_tokens_per_call / max_output_tokens_per_call:
- live_call_timeout_seconds:
- Approved provider/model routes / credential-source references:
- Price reference and checked-at / billing units / currency conversion / allowance:
- Observed spend / outstanding reservations / unknown cost / attempts / remaining allowance:
- Worker allocations or serialized dispatch; resume retains prior usage:

## References

- Add owned documents, source revisions, contracts, and decisions.

## Checklist

- [ ] Break work into ordered steps and keep them truthful.
- [ ] Include verification and documentation updates.

## Decisions and Notes

- Record assumptions and route discoveries through `docs/TASK_WORKFLOW.md`.

## Charter Amendment Log

- none

## Verification

- [ ] Review actual changes against the necessity arguments and frozen scope.
- [ ] Record exact checks and outputs.
- [ ] Record skipped checks and reasons.

## Documentation Updates

- [ ] `docs/CURRENT_STATUS.md`
- [ ] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md`
- [ ] `docs/FILESTRUCTURE.md` when structure changes
- [ ] ADRs and collection indexes when needed

## Handoff and Follow-ups

- Current state:
- Next recommended step:
- Blockers:
- Child tasks:
- Resume condition:
- Open questions:

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task. template: template_CURRENT_TASK.md
- Append a signed `docs/JOURNAL.md` entry.
