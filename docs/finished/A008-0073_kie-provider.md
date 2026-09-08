# A008-0073 — kie.ai provider

Task ID: A008-0073
Parent Task: None
Status: Complete
Owner: Grok (operator)
Created: 2026-09-08
Last updated: 2026-09-08
Charter frozen at: 2026-09-08

## Goal

Call kie.ai chat and image models from the existing GUI/CLI without putting the
key in the renderer.

## Completion

Implemented. See [evidence](../evidence/A008-0073_kie-provider.md) and
[ADR 0033](../adr/0033-kie-provider.md).
`npm test` passed. No live kie.ai or NVIDIA call.
