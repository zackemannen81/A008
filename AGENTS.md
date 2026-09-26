# AGENTS.md

This repository is docs-first. Every task begins in
`docs/CURRENT_TASK.md`; chat history and agent memory are never project
authority.

## Project Identity

- Project: A008
- Task prefix: `A008`
- Purpose: build one AI client with a shared engine, CLI, A008-owned GUI/host,
  stable external-client surfaces, and optional capabilities such as semantic
  memory. Agent Canvas remains a supported ACP compatibility/operator path,
  not the product GUI.
- Phase: product implementation. Shared core, CLI, A008-owned GUI host/client,
  and local semantic memory exist. Remaining work is bounded product slices.
- License: Apache-2.0 for A008-owned repository contents. Imported or adapted
  third-party material retains its own notices and terms.

## Start Here

Read these in order before changing the repository:

1. `docs/CURRENT_TASK.md`
2. `docs/TASK_WORKFLOW.md`
3. `docs/PROJECT_BRIEF.md`
4. `docs/CONTRIBUTING.md`
5. `docs/CURRENT_STATUS.md`
6. `docs/SYSTEMDOC.md`
7. `docs/CURRENT_MEMORY_MODEL.md` when work touches knowledge, state, memory, retrieval or context
8. `docs/JOURNAL.md`
9. `docs/FILESTRUCTURE.md`

Read relevant accepted top-level decisions under `docs/adr/` and the multi-agent rules in
`docs/MULTIAGENT.md` when a task delegates work. `docs/adr/_legacy/` is historical provenance only and never current authority.

## IMPORTANT REGARDING CONFLICTS AND BLOCKERS

If a contradiction blocks your task from being completed do this:
1. Explain why it blocks your work.
2. Suggest smallest possible modification making you be able to fully forfill all DoD of current task.
  this could be suggesting a new ADR aswell.
3. Wait for approval.
4. When approved:
5.0 Put current task as paused
5.1 claim a child task id and publish to remote main.
5.2 charter the task 
5.3 freeze the child to ready when you have verified the task DoD will remove the blocker.
5.4 Implement the changes.
5.5 archive the child task
5.6 unpause the main task
5.7 comtinue the task
if not approved:
6. stop and wait further instructions.

## Truth Ownership

- `docs/CURRENT_TASK.md`: empty template on `main`. A worker may fill it on
  its branch while implementing, then must restore the template before push.
  Active program records live under `docs/tasks/`.
- `docs/PROJECT_BRIEF.md`: core product contract, approved direction and non-goals.
- `docs/CURRENT_STATUS.md`: observed current reality and verified gaps.
- `docs/SYSTEMDOC.md`: durable behavior that actually exists.

- `docs/JOURNAL.md`: append-only, dated work waves.
- `docs/FILESTRUCTURE.md`: repository map.
- `docs/TASK_IDS.md`: identity allocation only.
- `docs/adr/`: accepted current decisions and consequences; `_legacy/` is historical only.
- `docs/backlog/`: in-scope work that is not active.
- `docs/concepts_sandbox/`: non-authoritative ideas.
- `docs/_legacy/`: local provenance boundary; never current authority.

## Source Boundaries

- Raw legacy material under `docs/_legacy/agenten007/` is local provenance. It
  is ignored by Git and must not be executed or copied wholesale.
- The A008 memory engine lives in `src/memory/` with SQLite persistence and
  local CLI/ACP composition. The owner-supplied Context-First document remains
  architecture input, not an external code baseline. `C:\code\acme` is not an
  adopted source baseline; A008 does, however, deliberately consume the bounded
  published `acme-engine@0.1.6` package surface for default model execution.
- Bootstrap and protocol/add-on copies in the repository root are ignored
  reference inputs, not shipped A008 content.

## Task Workflow

- Claim the next task ID on `main` before moving a charter from Draft to Ready.
  The operator owns allocation and delegates frozen charters; workers do not
  claim IDs.
- Ready freezes goal, primary deliverable, scope, out-of-scope, definition of
  done, and minimum gates.
- Do not absorb discoveries into a frozen task. Route them through the checklist,
  a bounded child, the backlog, or the concepts sandbox.
- Update owning documentation in the same change as behavior.
- Finish only after verification, an immutable archive under `docs/finished/`,
  a handoff, and restoration of `docs/CURRENT_TASK.md` from
  `docs/template_CURRENT_TASK.md` before push. `main` keeps that empty
  template. The operator appends the journal on merge.

### Necessity gate

Before Ready/delegation and substantive implementation, apply the Necessity Gate
in `docs/TASK_WORKFLOW.md` against the Core Product Contract in
`docs/PROJECT_BRIEF.md`. Record the exact PC clause and accepted constraint,
observable need and consequence of omission, smallest sufficient approach, and
verification in the task. Product necessity and frozen task scope must both
permit a change. Missing necessity means do not implement the affected change;
use existing routing. Recheck material changes and the final diff. Existing
code or a vague robustness claim cannot supply product authority.

## Multi-Agent Work

- Follow `docs/MULTIAGENT.md`.
- A writing worker gets one task, one branch, one physical worktree or clone,
  and one non-overlapping write scope.
- Writing clones live under `C:\code\A008-workers`, never inside the canonical
  `C:\code\A008` working tree.
- The operator owns task-ID allocation, the canonical working tree, integration,
  merge order, and release decisions. Workers restore the current-task template
  before they push so that file cannot conflict with `main`.
- The declared maximum is six concurrent writing workers, or any lower runtime
  limit. It is advisory until an execution layer enforces it.

## Safety

- Never commit credentials, personal data, model payloads, or private client
  material.
- Provider credentials come from environment or a reviewed secret provider,
  never source or command-line arguments.
- Do not execute the legacy client. Its exposed credential was revoked and
  rotated on 2026-09-01, but the raw script still embeds the retired value and
  remains unsafe provenance. Use the new environment-backed A008 adapter.
- Live-provider verification, including paid calls, is authorized within the
  task's verification scope, approved credentials/providers and the resolved
  budget in `docs/TASK_WORKFLOW.md#live-verification-budget`. No per-call owner
  approval is needed within those limits. Model-specific prices determine cost;
  free calls still consume call/token/time limits. Escalate budget increases,
  new cost-bearing services or materially different external effects.
- No push, deployment, publication or destructive operation without explicit
  task authority. A verification budget does not grant those permissions.
- OpenHands host mode and local agent processes can access the host filesystem.
  Treat sandbox and permission decisions as explicit security work.

## Repository identity and provenance

This repository is **A008**.

A008 is the active canonical repository and the current Single Source of Truth
for the Agent 007 project.

### Repository lineage

The project lineage is:

A007 (original project created by Rickard Zakrisson; now RETIRED)
├── A008 (successor repository; ACTIVE CANONICAL SSOT)
└── felixnissen/a007-frontend
    (downstream frontend repository derived from A007)

### Current authority

A007 is retired and MUST NOT be treated as the current source of truth.

A008 superseded A007 as the canonical implementation and project authority.

`felixnissen/a007-frontend` was created from A007 and contains frontend work
and modifications by Felix Nissen. It is not, and has never been, the upstream
or canonical source of A007 or A008.

### Mandatory reasoning rule

When determining project provenance, ownership, architectural authority,
implementation authority, or current project state:

1. Treat A008 as the current canonical SSOT.
2. Treat A007 only as historical ancestry.
3. Treat `a007-frontend` as a downstream derivative originating from A007.
4. Never infer upstream status from GitHub repository ownership, remote names,
   commit timestamps, fork relationships, directory names, or where newer code
   happens to exist.
5. Historical ancestry does not imply current authority.
