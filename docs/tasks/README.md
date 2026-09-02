# Task Charters

Discoverability: naming convention `A008-NNNN_task-slug.md`.
Member state: required. Every member declares a `Status:` line.

This directory holds frozen program and child charters. `docs/CURRENT_TASK.md`
on `main` is the empty template. The operator claims IDs and delegates one
charter per worker. A worker may copy its charter into `docs/CURRENT_TASK.md`
on its branch while working, then archives it to `docs/finished/` and restores
the template before push.

## Records

- [`A008-0041_source-upload-ingest.md`](A008-0041_source-upload-ingest.md) — In
  Progress; source upload ingest program (ADR 0020).
- [`A008-0042_source-extraction-port.md`](A008-0042_source-extraction-port.md) — Ready.
- [`A008-0043_runtime-source-ingest.md`](A008-0043_runtime-source-ingest.md) — Ready.
- [`A008-0044_gui-host-upload.md`](A008-0044_gui-host-upload.md) — Ready.
- [`A008-0045_gui-upload-module.md`](A008-0045_gui-upload-module.md) — Ready.

- [`A008-0030_a008-owned-gui.md`](A008-0030_a008-owned-gui.md) — Complete;
  product GUI program, all six children merged to `main` 2026-09-02; archived
  [`../finished/A008-0030_a008-owned-gui.md`](../finished/A008-0030_a008-owned-gui.md).
- [`A008-0032_gui-host.md`](A008-0032_gui-host.md) — Merged PR #11.
- [`A008-0033_gui-session.md`](A008-0033_gui-session.md) — Merged PR #10.
- [`A008-0034_gui-chat.md`](A008-0034_gui-chat.md) — Merged PR #12.
- [`A008-0035_gui-composer.md`](A008-0035_gui-composer.md) — Merged PR #8.
- [`A008-0036_gui-terminal.md`](A008-0036_gui-terminal.md) — Merged PR #7.
- [`A008-0037_gui-settings-brand.md`](A008-0037_gui-settings-brand.md) — Merged PR #9.

- [`A008-0038_acp-session-release.md`](A008-0038_acp-session-release.md) —
  Merged PR #13; archived
  [`../finished/A008-0038_acp-session-release.md`](../finished/A008-0038_acp-session-release.md).
- [`A008-0039_gui-test-command.md`](A008-0039_gui-test-command.md) —
  Merged PR #14; archived
  [`../finished/A008-0039_gui-test-command.md`](../finished/A008-0039_gui-test-command.md).
- [`A008-0040_ingest-provenance-relation.md`](A008-0040_ingest-provenance-relation.md) —
  Merged PR #15; archived
  [`../finished/A008-0040_ingest-provenance-relation.md`](../finished/A008-0040_ingest-provenance-relation.md).

- [`A008-0029_cli-slash-and-terminal.md`](A008-0029_cli-slash-and-terminal.md)
  — Complete; archived
  [`../finished/A008-0029_cli-slash-and-terminal.md`](../finished/A008-0029_cli-slash-and-terminal.md).

- [`A008-0021_close-knowledge-model-gap.md`](A008-0021_close-knowledge-model-gap.md)
  — Complete; archived
  [`../finished/A008-0021_close-knowledge-model-gap.md`](../finished/A008-0021_close-knowledge-model-gap.md).

- [`A008-0023_repair-direct-match-eligibility.md`](A008-0023_repair-direct-match-eligibility.md)
  — Merged to `main` 2026-09-02 (PR #2).
- [`A008-0024_semantic-addressing.md`](A008-0024_semantic-addressing.md)
  — Merged to `main` 2026-09-02 (PR #1).
- [`A008-0025_state-history-split.md`](A008-0025_state-history-split.md)
  — Merged to `main` 2026-09-02 (PR #4).
- [`A008-0026_first-class-evidence.md`](A008-0026_first-class-evidence.md)
  — Merged to `main` 2026-09-02 (PR #3).
- [`A008-0027_evidence-lifecycle-intents.md`](A008-0027_evidence-lifecycle-intents.md)
  — Merged to `main` 2026-09-02 (PR #5). Also archived under `docs/finished/`.
- [`A008-0028_storage-redesign.md`](A008-0028_storage-redesign.md)
  — Merged to `main` 2026-09-02 (PR #6). Also archived under `docs/finished/`.
