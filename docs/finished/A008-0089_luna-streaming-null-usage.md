# Current Task

Task ID: A008-0089
Parent Task: A008-0088
Status: Complete
Owner: Codex (operator)
Created: 2026-09-09
Last updated: 2026-09-09
Charter frozen at: 2026-09-09T02:11+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0036-openai-gpt-56-luna-provider.md`

## Task Summary

Fix the live Luna streaming failure caused by OpenAI SSE events that carry `usage: null` before final usage is available.

## Task Charter

### Goal

Make OpenAI streaming tolerate the provider's documented/observed nullable usage field without misclassifying the turn as a network failure.

### Primary Deliverable

A bounded parser fix plus regression coverage and live verification.
### In Scope

- Accept `usage: null` in OpenAI streaming events.
- Preserve final non-null usage accounting.
- Add a regression with an intermediate nullable usage event.
- Verify with the owner's configured key without exposing it.

### Out of Scope

- Responses API migration.
- Provider retry policy changes.
- Any other OpenAI model integration.

### Definition of Done

- Streaming Luna + tools completes successfully.
- Focused adapter tests pass.
- Full repository test suite and GUI build pass.
- No credential enters Git or logs.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3799b22`

| Change | Clause and constraint | Outcome | Smallest change | Check |
| --- | --- | --- | --- | --- |
| Nullable usage parser | PC-01 | Live Luna streaming no longer crashes | Provider-local null guard | Unit + live smoke |

### Minimum Verification Gates

- [x] OpenAI adapter tests pass.
- [x] Live streaming + tool probe returns HTTP success.
- [x] `npm test` passes.
- [x] `npm --prefix gui run build` passes.
- [x] `git diff --check` passes.
## References

- Owner screenshot: `OpenAI network request failed.`
- Live stack trace: `usageFrom()` dereferenced `null` from an SSE event with `usage: null`.

## Checklist

- [x] Reproduce the live failure through A008's real OpenAI streaming adapter.
- [x] Identify the exact parser defect.
- [x] Patch nullable usage handling.
- [x] Add regression coverage.
- [x] Run full verification, document, archive, commit and push.

## Decisions and Notes

- The failure was not network-related; the adapter catch boundary mislabeled a parser `TypeError` as a network error.
- Intermediate `usage: null` is treated as no usage yet; the final usage event remains authoritative.

## Verification

- Focused OpenAI adapter: 5/5 passed.
- Owner-authorized live streaming Luna + function-tool probe returned `OK`.
- Full suite: 540 core, 4 membership and 119 GUI tests passed.
- Production GUI build and `git diff --check` passed.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] ADR 0036 compatibility note

## Handoff and Follow-ups

- Current state: Complete; parser fix verified live and offline.
- Next recommended step: restart live host and retry from the standalone client.
- Blockers: none.