# Contributing

A008 uses a docs-first workflow. The active task is always defined in
`docs/CURRENT_TASK.md`.

## License

A008 repository source is licensed under Apache License 2.0. Unless a file
explicitly says otherwise, contributions submitted for inclusion are expected
to be distributable under the same license. Do not submit code or assets whose
terms are incompatible, and never commit credentials or personal data.

## Required Reading

1. `AGENTS.md`
2. `docs/CURRENT_TASK.md`
3. `docs/TASK_WORKFLOW.md`
4. `docs/PROJECT_BRIEF.md`
5. `docs/CURRENT_STATUS.md`
6. `docs/SYSTEMDOC.md`
7. relevant ADRs
8. latest `docs/JOURNAL.md` entry

## Standard Task Loop

### 1. Define

Create or update `docs/CURRENT_TASK.md` before implementation. Include:

- unique Task ID
- goal and motivation
- primary deliverable
- success criteria
- in-scope and out-of-scope work
- references
- ordered checklist (Keep the checklist updated during your work)
- verification plan
- documentation targets

The Task Charter is editable in `Draft` and frozen at `Ready`.

### 2. Implement

- Keep changes within task scope.
- Preserve unrelated worktree changes.
- Keep the checklist current.
- Do not redefine a frozen Goal, Primary Deliverable or Definition of Done.
- Use `docs/TASK_WORKFLOW.md` to classify discoveries:
  - required by current DoD → checklist
  - blocking prerequisite → paused parent plus child task
  - non-blocking new work → backlog proposal
  - invalid original objective → supersede and create a new task
- Add / Supersede or update ADRs when a durable architectural decision is made.
- Update system/status documentation with the implementation, not later.

### 3. Verify

Run the task-specific checks. Future code changes should normally include:

- typecheck
- unit tests

Live model evaluations are separate from deterministic tests.

### 4. Handoff

Record:

- completed work
- verification results
- known limitations
- next steps
- blockers and open questions

Add the summary to `docs/JOURNAL.md`.

### 5. Finish

- Archive the completed task in `docs/finished/`.
- Restore  `docs/CURRENT_TASK.md`with `docs/template_CURRENT_TASK.md` or populate for the actual next task.

## Scope Freeze

After a task reaches `Ready`, these sections are immutable:

- Goal
- Primary Deliverable
- In Scope
- Out of Scope
- Definition of Done
- minimum verification gates

Only non-semantic corrections are allowed, and they must be recorded in the
task's Charter Amendment Log. A semantic change requires a new task.

At most one task is active in `docs/CURRENT_TASK.md`. Paused parent tasks live
under `docs/paused/`; non-activated proposals live under `docs/backlog/`.

## Branches and Commits

- Use focused branches and commits.
- Suggested branch prefixes: `feat/`, `fix/`, `docs/`, `chore/`.
llm-agents:
- Suggested branch prefixes: `provider/`
- Do not mix mechanical cleanup with behavioral changes.
- A commit message should describe the outcome, not merely the files touched.

## Architecture Changes

Create an ADR when a decision affects:

- a public or cross-package contract
- dependency direction
- state or memory semantics
- persistence or migrations
- execution/retry/replay behavior
- provider abstraction
- compatibility or versioning
- security or privacy

The live integration / provider calls needs real traffic, so it cannot gate every
commit. Run it before any acceptance attempt: it is what narrows the window in
which a live regression reaches acceptance undetected.
User gpt-5.6-luna or NVIDIA Nemotron for live Calls

Cost is measured, not capped. `summarizeModelCallUsage` reads recorded calls
and reports counts, tokens and provider-supplied cost; an acceptance run
reports what it actually consumed rather than stopping at an arbitrary
threshold.

## External Effects

Do not publish packages, deploy services, push branches, create releases or
run paid model evaluations unless the active task explicitly authorizes it.
