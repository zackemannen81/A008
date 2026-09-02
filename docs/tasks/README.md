# Task Charters

Discoverability: naming convention `A008-NNNN_task-slug.md`.
Member state: required. Every member declares a `Status:` line.

This directory holds frozen child charters for a program whose active task
lives in `docs/CURRENT_TASK.md`. A writing worker copies its charter into
`docs/CURRENT_TASK.md` on its branch. The operator restores the parent
current-task record when merging to `main`.

## Records

- [`A008-0023_repair-direct-match-eligibility.md`](A008-0023_repair-direct-match-eligibility.md)
  — Ready; M1 eligibility repair.
- [`A008-0024_semantic-addressing.md`](A008-0024_semantic-addressing.md)
  — Ready; M3 semantic addressing.
- [`A008-0025_state-history-split.md`](A008-0025_state-history-split.md)
  — Ready; M4 state/history split. Blocked on A008-0024 merge.
- [`A008-0026_first-class-evidence.md`](A008-0026_first-class-evidence.md)
  — Ready; M5 evidence and acceptance. Blocked on A008-0024 merge.
- [`A008-0027_evidence-lifecycle-intents.md`](A008-0027_evidence-lifecycle-intents.md)
  — Ready; M6 lifecycle and retrieval intents. Blocked on A008-0025 and
  A008-0026 merge.
- [`A008-0028_storage-redesign.md`](A008-0028_storage-redesign.md)
  — Ready; M7 storage. Blocked on A008-0027 merge.
