# Contributing

ACME uses a docs-first workflow. The active task is always defined in
`docs/CURRENT_TASK.md`.

## License

ACME repository source is licensed under Apache License 2.0. Unless a file
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
- ordered checklist
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
- Add or update ADRs when a durable architectural decision is made.
- Update system/status documentation with the implementation, not later.

### 3. Verify

Run the task-specific checks. Future code changes should normally include:

- typecheck
- unit tests
- package boundary checks
- relevant conformance/integration tests
- deterministic scenario tests

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
- Restore or populate `docs/CURRENT_TASK.md` for the actual next task.

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
- Do not mix mechanical cleanup with behavioral changes.
- A commit message should describe the outcome, not merely the files touched.

## Files Cited by Documentation

- Do not rename, move or delete a file that documentation cites. Citations from
  `docs/JOURNAL.md`, `docs/finished/`, accepted ADRs and `docs/acceptance/`
  cannot be repaired afterwards, because those records may not be edited.
- This binds source files, tests, fixtures and mocks, not only Markdown. An
  acceptance record naming a test file freezes that test's path.
- Do not cite disposable material from an immutable record. Give it a stable
  path first, or describe it instead of linking it. A directory called `temp`
  stops being temporary the moment an archived task names a file inside it.
- Express state in content and in the collection index. A filename is an
  address, not a status field.

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

## Verification Tiers

ADR-0044 separates verification into three tiers. Each supports a different
claim, and a claim from one tier may never be reported as a claim from
another.

| Tier | Commands | Substrate | Provider | Claim it supports |
| --- | --- | --- | --- | --- |
| Offline deterministic | `pnpm test` (`test:unit`, `test:conformance`, `test:integration`, `test:scenario`) | in-memory, file, SQLite | mock | the code behaves as specified |
| Live integration | `pnpm test:postgres`, `pnpm test:supabase-auth` | real PostgreSQL, real object store | real where configured | the composition works against real infrastructure |
| POC acceptance | `pnpm test:live` | real PostgreSQL, real object store, real case | real | the product performs a real evidence workflow |

The offline tier is fast, free and reproducible. It gates CI and runs
continuously. It is the only tier that may be assumed green.

The live integration tier needs real infrastructure, so it cannot gate every
commit. Run it before any acceptance attempt: it is what narrows the window in
which a live regression reaches acceptance undetected.

Only a POC acceptance run may state that POC #1 works. A green offline suite
says nothing about transaction boundaries, persistence, reconnects, case
isolation, migrations, partial failures or real projection state — the
properties the product exists to provide. ACME-0131 is the standing example:
the offline suite was green while the worker mutated product state before its
own guard.

Cost is measured, not capped. `summarizeModelCallUsage` reads recorded calls
and reports counts, tokens and provider-supplied cost; an acceptance run
reports what it actually consumed rather than stopping at an arbitrary
threshold.

## External Effects

Do not publish packages, deploy services, push branches, create releases or
run paid model evaluations unless the active task explicitly authorizes it.
