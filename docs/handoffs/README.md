# Integration Handoffs

Discoverability: naming convention `A008-NNNN.md`.
Member state: required. Every member declares a `Status:` line.

A writing worker writes one handoff when it opens a pull request, after
archiving its charter to `docs/finished/` and restoring
`docs/CURRENT_TASK.md` from the template. The operator treats repository
state plus this file as integration evidence. Worker transcripts are not
authority. Workers do not append `docs/JOURNAL.md`.

## Required fields

Latest persistence handoff: [A008-0101](A008-0101.md) — incremental SQLite
knowledge writes; merged through PR #44, host restarted and health/auth verified.

Latest local handoffs: [A008-0093](A008-0093.md) — global Neutral/Deep Space
theme system;
[A008-0071](A008-0071.md) — NVIDIA catalog and images;
[A008-0070](A008-0070.md) — workbench, Help and memory map;
[A008-0067](A008-0067.md) — complete engine and panels;
[A008-0066](A008-0066.md) — owner-merged runtime preferences closure.

- Task ID and branch
- Head commit SHA
- Pull request URL
- Files changed
- Exact verification commands and results
- Skipped gates and reasons
- Blockers
- Next recommended operator action

## Records

- [A008-0064.md](A008-0064.md) — Complete locally; three read-only memory GUI
  views with real runtime data and browser verification. Not pushed.

- [`A008-0024.md`](A008-0024.md) — M3 semantic addressing. Merged 2026-09-02.
- [A008-0023](A008-0023.md) — implementation already integrated; PR #2 closed.
  Late historical worker handoff incorporated during 2026-09-14 integration.
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
- [`A008-0042.md`](A008-0042.md) — source extraction port. Merged 2026-09-03 (PR #16).
- [`A008-0043.md`](A008-0043.md) — runtime source-ingest and ACP method. Merged 2026-09-03 (PR #19).
- [`A008-0044.md`](A008-0044.md) — GUI host upload route and blob store. Merged 2026-09-03 (PR #18).
- [`A008-0045.md`](A008-0045.md) — GUI upload module. Merged 2026-09-03 (PR #17).
- [A008-0068.md](A008-0068.md) — Standalone GUI repository tools.
- [A008-0082.md](A008-0082.md) — Complete; independent L3 association lifecycle.
