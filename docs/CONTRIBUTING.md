# Contributing

## Required reading

Read `AGENTS.md` and its ordered authority list before changing the repository.

## Working loop

1. The operator claims a task identity on `main` and delegates a frozen charter.
2. A worker may copy that charter into `docs/CURRENT_TASK.md` on its branch.
3. Work the checklist and keep it truthful.
4. Verify against the named gates.
5. Update owned documents in the same change as behavior.
6. Archive the task under `docs/finished/`, restore `docs/CURRENT_TASK.md` from
   the template, write the handoff, then push and open a pull request.
7. The operator merges to `main` and appends the journal.

## Source intake

- Pin source repository, revision, license, and provenance before importing.
- Prefer an adapter or stable dependency boundary to copying a source tree.
- Preserve required copyright and license notices.
- Never import raw legacy dependencies, outputs, credentials, or unrelated
  artifacts.
- A source document's MUST language becomes A008 authority only when explicitly
  adopted by an A008 decision or frozen charter.

## Verification baseline

Documentation work checks links, fences, collection indexes, staged secrets,
and `git diff --check`. Product charters must add typecheck, unit, contract,
integration, packaging, installation, and platform gates in proportion to the
slice. Live-provider tests require separate credential and cost authority.

## Licensing

Contributions intentionally submitted to A008 are Apache-2.0 unless a file
states otherwise. Third-party source retains its original license boundary.
