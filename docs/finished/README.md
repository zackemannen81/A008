# Finished Tasks

Discoverability: naming convention `A008-NNNN_task-slug.md`.
Member state: required. Every member declares a `Status:` line.

Archived tasks are immutable historical context. They are never renamed or
moved. Current behavior belongs in `docs/CURRENT_STATUS.md` and
`docs/SYSTEMDOC.md`.

A writing worker writes its completed charter here **before** restoring
`docs/CURRENT_TASK.md` to the template and pushing. That is how CURRENT_TASK
stays conflict-free against `main`.
