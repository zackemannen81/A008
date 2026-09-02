# Task Workflow

## States

```text
Draft -> Ready -> In Progress -> Complete
                   |
                   v
                 Paused -> In Progress

Draft / Ready / In Progress / Paused
  -> Cancelled or Superseded
```

Draft is editable. Ready freezes the goal, primary deliverable, scope,
out-of-scope, definition of done, and minimum verification gates. A frozen
charter is superseded rather than redefined.

## Identity

Append the next identity to `docs/TASK_IDS.md` on `main` before Ready. The
register allocates addresses only; activity belongs to the task record.

## Discoveries

```text
Required by the frozen charter?
|- yes -> add a truthful checklist step
`- no
   |- blocks the charter -> pause parent; activate a bounded child
   |- useful later       -> docs/backlog/
   `- outside direction  -> docs/concepts_sandbox/
```

Backlog entries state context, outcome, why they are not active, dependencies,
and suggested verification. They stay at stable paths and are indexed.

## Pause

A pause records the blocker, completed work, next action, missing verification,
and an objective resume condition. The frozen record moves to `docs/paused/`.

## Completion

- Verify in proportion to risk and name skipped gates with reasons.
- Update all owning documents.
- Archive the completed task immutably under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` byte-for-byte from
  `docs/template_CURRENT_TASK.md` **before** the last commit and push.
- The operator appends the signed journal entry on merge to `main`.

At most one task is active per branch while work is in progress. A contributor
must be able to resume from repository state without private chat history.

## `main` and pull-request hygiene

`docs/CURRENT_TASK.md` on `main` is the empty template. It is not a merge
vehicle. Program records live under `docs/tasks/`. The operator claims every
identity on `main` and delegates a frozen charter. Workers do not allocate IDs.

A worker may copy its delegated charter into `docs/CURRENT_TASK.md` on its
branch while implementing. Before the last commit and push it must:

1. Archive the completed charter to `docs/finished/A008-NNNN_task-slug.md`
   with `Status: Complete`.
2. Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
3. Write `docs/handoffs/A008-NNNN.md`.
4. Push and open a pull request. Do not merge.

Then `docs/CURRENT_TASK.md` is identical on the branch and on `main`, so it
cannot conflict.
