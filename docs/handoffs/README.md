# Integration Handoffs

Discoverability: naming convention `A008-NNNN.md`.
Member state: required. Every member declares a `Status:` line.

A writing worker writes one handoff when it opens a pull request, after
archiving its charter to `docs/finished/` and restoring
`docs/CURRENT_TASK.md` from the template. The operator treats repository
state plus this file as integration evidence. Worker transcripts are not
authority. Workers do not append `docs/JOURNAL.md`.

## Required fields

- Task ID and branch
- Head commit SHA
- Pull request URL
- Files changed
- Exact verification commands and results
- Skipped gates and reasons
- Blockers
- Next recommended operator action

## Records

- [`A008-0024.md`](A008-0024.md) — Ready for operator merge; M3 semantic
  addressing. Merged to `main` 2026-09-02.
- A008-0023 — no worker handoff file; PR #2 code is the handoff. Merged to
  `main` 2026-09-02.
