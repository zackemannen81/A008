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
- Append a signed journal entry.
- Archive the completed task immutably under `docs/finished/`.
- Restore the clean current-task template or activate the next approved task.

At most one task is active per branch. A contributor must be able to resume from
repository state without private chat history.
