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

- [`A008-0024.md`](A008-0024.md) — M3 semantic addressing. Merged 2026-09-02.
- A008-0023 — no worker handoff file; PR #2 code is the handoff. Merged 2026-09-02.
- [`A008-0025.md`](A008-0025.md) — M4 state/history split. Merged 2026-09-02 (PR #4).
- [`A008-0026.md`](A008-0026.md) — M5 evidence and ACCEPT. Merged 2026-09-02 (PR #3).
- [`A008-0027.md`](A008-0027.md) — M6 lifecycle and retrieval intents. Merged 2026-09-02 (PR #5).
- [`A008-0028.md`](A008-0028.md) — M7 storage and live cutover. Merged 2026-09-02 (PR #6).
- [`A008-0032.md`](A008-0032.md) — GUI host ACP WebSocket bridge. Merged 2026-09-02 (PR #11).
- [`A008-0033.md`](A008-0033.md) — GUI session client. Merged 2026-09-02 (PR #10).
- [`A008-0034.md`](A008-0034.md) — GUI chat transcript. Merged 2026-09-02 (PR #12).
- [`A008-0035.md`](A008-0035.md) — GUI composer slash commands. Merged 2026-09-02 (PR #8).
- [`A008-0036.md`](A008-0036.md) — GUI terminal pane. Merged 2026-09-02 (PR #7).
- [`A008-0037.md`](A008-0037.md) — GUI settings and brand identity. Merged 2026-09-02 (PR #9).
- [`A008-0038.md`](A008-0038.md) — ACP session release on renderer disconnect. Merged 2026-09-02 (PR #13).
- [`A008-0039.md`](A008-0039.md) — one command for the GUI module tests. Merged 2026-09-02 (PR #14).
- [`A008-0040.md`](A008-0040.md) — caller-named INGEST provenance relation. Merged 2026-09-02 (PR #15).
