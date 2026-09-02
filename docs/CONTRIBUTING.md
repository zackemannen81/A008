# Contributing

## Required reading

Read `AGENTS.md` and its ordered authority list before changing the repository.

## Working loop

1. Claim a task identity on `main`.
2. Draft and review `docs/CURRENT_TASK.md`.
3. Move it to Ready to freeze the charter.
4. Work the checklist and keep it truthful.
5. Verify against the named gates.
6. Update current truth and durable system documentation with the change.
7. Archive the task, append the journal, and restore a clean active state.

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
