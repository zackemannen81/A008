# AGENTS.md

This repository is docs-first. Every task begins in
`docs/CURRENT_TASK.md`; chat history and agent memory are never project
authority.

## Project Identity

- Project: A008
- Task prefix: `A008`
- Purpose: build one AI client with a shared core, a CLI, an Agent
  Canvas-derived GUI/client, and optional add-ons such as semantic memory.
- Phase: repository bootstrap; no A008 product source exists yet.
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
7. `docs/JOURNAL.md`
8. `docs/FILESTRUCTURE.md`

Read relevant decisions under `docs/adr/` and the multi-agent rules in
`docs/MULTIAGENT.md` when a task delegates work.

## Truth Ownership

- `docs/CURRENT_TASK.md`: empty template on `main`. A worker may fill it on
  its branch while implementing, then must restore the template before push.
  Active program records live under `docs/tasks/`.
- `docs/PROJECT_BRIEF.md`: approved product direction and non-goals.
- `docs/CURRENT_STATUS.md`: observed current reality and verified gaps.
- `docs/SYSTEMDOC.md`: durable behavior that actually exists.
- `docs/JOURNAL.md`: append-only, dated work waves.
- `docs/FILESTRUCTURE.md`: repository map.
- `docs/TASK_IDS.md`: identity allocation only.
- `docs/adr/`: durable decisions and consequences.
- `docs/backlog/`: in-scope work that is not active.
- `docs/concepts_sandbox/`: non-authoritative ideas.
- `docs/_legacy/`: local provenance boundary; never current authority.

## Source Boundaries

- Raw legacy material under `docs/_legacy/agenten007/` is local provenance. It
  is ignored by Git and must not be executed or copied wholesale.
- `C:\code\OpenHands` is an external MIT-licensed Agent Canvas source clone.
  Its repository instructions govern changes made there; it is not A008 truth.
- The A008 memory-engine has not been created. The owner-supplied Context-First
  document is architecture input, not executable source. Related repositories
  such as `C:\code\acme` are not a baseline or dependency unless a future owner
  decision explicitly adopts a bounded part.
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

## Multi-Agent Work

- Follow `docs/MULTIAGENT.md`.
- A writing worker gets one task, one branch, one physical worktree or clone,
  and one non-overlapping write scope.
- Writing clones live under `C:\code\A008-workers`, never inside the canonical
  `C:\code\A008` working tree.
- The operator owns task-ID allocation, the canonical working tree, integration,
  merge order, and release decisions. Workers restore the current-task template
  before they push so that file cannot conflict with `main`.
- The declared maximum is five concurrent writing workers, or any lower runtime
  limit. It is advisory until an execution layer enforces it.

## Safety

- Never commit credentials, personal data, model payloads, or private client
  material.
- Provider credentials come from environment or a reviewed secret provider,
  never source or command-line arguments.
- Do not execute the legacy client. Its exposed credential was revoked and
  rotated on 2026-09-01, but the raw script still embeds the retired value and
  remains unsafe provenance. Use the new environment-backed A008 adapter.
- No push, deployment, publication, paid call, live provider test, or destructive
  operation without explicit task authority.
- OpenHands host mode and local agent processes can access the host filesystem.
  Treat sandbox and permission decisions as explicit security work.
