# Task Workflow

Status: Canonical
Last updated: 2026-07-29

This document prevents active tasks from becoming open-ended containers for
changing goals.

## Core Rule

Every task has a **Task Charter**. The charter is editable while the task is
`Draft`. It becomes frozen when the task reaches `Ready`.

The frozen charter contains:

- Goal
- Primary deliverable
- In scope
- Out of scope
- Definition of Done
- Minimum verification gates

After the charter is frozen, these sections must not be expanded, weakened or
redefined inside the same task.

## Task States

```text
Draft
  → Ready
  → In Progress
  → Complete

In Progress
  → Paused
  → In Progress

Draft / Ready / In Progress / Paused
  → Cancelled
  → Superseded
```

### Draft

The task is being shaped. The charter may change.

### Ready

The charter is complete and frozen. Work may begin.

### In Progress

Work is actively being performed against the frozen charter.

### Paused

The task remains valid but cannot progress until a named child task,
prerequisite or external condition is complete.

### Complete

All Definition of Done and required verification items pass.

### Cancelled

The task is intentionally abandoned without a replacement objective.

### Superseded

The original objective or Definition of Done is no longer correct. The task is
archived unchanged and a new task is created with a new charter.

## Task IDs

Activated tasks receive a monotonically increasing identifier:

```text
ACME-0001
ACME-0002
ACME-0003
```

The identifier never changes, including when the task is paused, resumed,
cancelled or superseded.

Recommended filenames:

```text
docs/paused/ACME-0003_task-slug.md
docs/finished/ACME-0003_task-slug.md
```

Backlog proposals do not require an ACME task ID until they are activated.

## Scope Change Decision Tree

When new work is discovered, ask these questions in order:

```text
1. Is it required to satisfy the existing frozen Definition of Done?
   |
   ├─ Yes: add or refine a checklist step.
   |       Do not change the charter.
   |
   └─ No
       |
       2. Does it block the current task?
       |
       ├─ Yes: pause the parent and create a bounded child task.
       |
       └─ No
           |
           3. Does it change the goal, deliverable or Definition of Done?
           |
           ├─ Yes: supersede the current task and create a new task.
           |
           └─ No: record it as a backlog proposal or future task.
```

## What May Change After Ready

The following sections remain mutable:

- checklist progress
- implementation notes
- discovered evidence
- verification results
- blockers
- links to child tasks
- handoff and follow-ups

A checklist item may be added only when it is necessary to satisfy the frozen
charter. It must not introduce a new independently useful deliverable.

Minimum verification gates may be strengthened when risk is discovered. They
must not be removed or weakened inside the task.

## Charter Corrections

Non-semantic corrections are allowed:

- spelling
- broken links
- formatting
- clarifications that narrow ambiguity without changing the outcome

Every post-`Ready` charter correction must be recorded in the task's
`Charter Amendment Log` with:

- date
- exact change
- reason
- statement that goal and Definition of Done are unchanged

If that statement cannot be made honestly, create a new task.

## Pausing for a Child Task

Use a child task only when the work is required to unblock the parent.

### Pause the parent

1. Set parent status to `Paused`.
2. Record the blocking condition.
3. Record the planned child task and resume condition.
4. Move the complete parent task file unchanged to `docs/paused/`.

### Activate the child

Create a new `docs/CURRENT_TASK.md` with:

- a new Task ID
- `Parent Task`
- a bounded frozen charter
- the exact condition it unblocks
- its own verification and Definition of Done

The child must not silently absorb unrelated improvements.

### Complete the child

1. Verify and archive the child under `docs/finished/`.
2. Add a signed journal entry.
3. Restore the parent from `docs/paused/` to `docs/CURRENT_TASK.md`.
4. Set the parent to `In Progress`.
5. Record the completed child and evidence.
6. Continue against the parent's original charter.

The parent's goal and Definition of Done remain unchanged.

## Task Identity

A Task ID is an identity in the same sense a path is. It appears in the active
charter, the archive filename, journal entries, branch names, commit messages
and pull request titles, and several of those cannot be rewritten afterwards.

Claim the ID in `docs/TASK_IDS.md` and merge that claim to `main` before the
charter moves to `Ready`. Append one row at the end of the table; never insert
into the middle and never sort. Two people claiming simultaneously then edit the
same region and the second gets a merge conflict rather than a silent duplicate.

The register allocates identity only. It carries no status column, because task
state already has owners in `docs/CURRENT_TASK.md` and `docs/finished/`, and a
trunk-level statement about active work would contradict the one-active-task
rule.

## Non-blocking Discoveries

Non-blocking discoveries must not interrupt the active task.

Record them under `docs/backlog/` with:

- title
- discovery context
- proposed outcome
- why it is outside the active charter
- dependencies
- suggested verification

They become tasks only when explicitly activated. Add the proposal to
`docs/backlog/README.md` in the same change; an unindexed proposal is invisible
to everyone who is not browsing the directory.

Resolving a proposal updates its `Status:` line and its index row. It never
renames or moves the file. Journal entries, archived tasks and accepted ADRs
cite proposals by path, and those records cannot be edited to follow a rename.
The same applies to activation: a proposal keeps its path after it becomes a
task, and the task records which proposal it came from.

## Superseding a Task

If the original goal or Definition of Done is wrong:

1. Stop work.
2. Set the task to `Superseded`.
3. Explain why the frozen charter is no longer valid.
4. Archive it under `docs/finished/`.
5. Create a new task with a new ID and charter.
6. Link both tasks in the journal.

Never rewrite history to make the original task appear correct.

## Task Size Rule

A task should have:

- one primary outcome
- one reviewable change set
- one coherent verification story

A task may produce several supporting files when all are necessary for the
same primary outcome.

Split the task before `Ready` when it contains:

- multiple independently valuable deliverables
- unrelated verification plans
- optional work disguised as acceptance criteria
- a migration and an unrelated refactor
- design, implementation and deployment that can be approved separately

## Single Active Task

`docs/CURRENT_TASK.md` contains exactly one active task.

- Paused tasks live under `docs/paused/`.
- Completed, cancelled and superseded tasks live under `docs/finished/`.
- Non-activated proposals live under `docs/backlog/`.

This keeps the active source of truth small without losing the task graph or
historical context.
