# Current Task

Task ID: A008-0088
Parent Task: A008-0087
Status: Complete
Owner: Codex (operator)
Created: 2026-09-09
Last updated: 2026-09-09
Charter frozen at: 2026-09-09T01:31+02:00

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0036-openai-gpt-56-luna-provider.md`

## Task Summary

Fix the live GPT-5.6 Luna HTTP 400 seen when A008 attaches its normal repository/shell function tools.

## Task Charter

### Goal

Make the shipped Luna path accept A008 tool-enabled turns without weakening explicit model routing or credential boundaries.
### Primary Deliverable

A bounded compatibility fix in the OpenAI transport plus routing regressions.

### In Scope

- Omit `temperature` for `gpt-5.6-luna` requests.
- Force effective `reasoning_effort: none` when Luna Chat Completions carries function tools.
- Preserve OpenAI's bounded provider error message on non-2xx responses.
- Ensure an explicit NVIDIA/Kimi/etc. model is never hijacked by `chatProvider=openai`.
- Regression tests and live-provider smoke proof.

### Out of Scope

- Migrating Luna to the Responses API.
- Automatic provider failover or retry policy.
- Changing tool approval semantics or memory behavior.

### Definition of Done

- Live A008 Luna request with a function tool returns HTTP 200.
- Luna payload contains no `temperature`.
- Tool-enabled Luna Chat Completions uses reasoning effort `none`.
- Explicit non-OpenAI model routing remains on its own provider.
- Full repository test suite and GUI build pass.
### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `01a70d5`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Luna tool compatibility | PC-01 / ADR 0036 | Tool-enabled Luna chat works; without it live turns fail HTTP 400 | Provider-local payload normalization | Real OpenAI smoke + adapter test |
| Explicit model routing | PC-01 | Selecting NVIDIA/Kimi cannot be silently rerouted to OpenAI by a saved provider preference | Remove OpenAI fallback override for known non-OpenAI models | Dispatch + ACP integration tests |
| Provider error detail | PC-05 | Operator sees bounded provider reason without exposing credentials | Parse only `error.message`, cap length | 400 error regression |

### Minimum Verification Gates

- [x] Focused OpenAI and previously failing integration tests pass: 39/39.
- [x] `npm test` passes: 540 core, 4 membership, 119 GUI.
- [x] `npm --prefix gui run build` passes.
- [x] `git diff --check` passes.
- [x] Live tool-shaped Luna request returns HTTP 200.

## References

- Owner live report: OpenAI HTTP 400 from `gpt-5.6-luna`.
- Live provider error: function tools plus non-none reasoning effort are unsupported in Chat Completions.
- `docs/adr/0036-openai-gpt-56-luna-provider.md`
## Checklist

- [x] Reproduce the live provider failure with the operator's configured key without exposing it.
- [x] Identify the exact incompatible payload combination.
- [x] Patch Luna payload normalization and explicit-model routing.
- [x] Add focused regressions.
- [x] Run full verification, archive, journal, commit and push.

## Decisions and Notes

- Direct live probes showed `temperature: 0` itself succeeds on Luna; the observed 400 was caused by function tools plus `reasoning_effort: medium`.
- The owner nevertheless requested that A008 omit `temperature` entirely for Luna, so the transport does so.
- Chat Completions remains in place for this bounded fix; Responses API is a later architectural option.

## Charter Amendment Log

- none

## Verification

- Focused adapter and six previously failing integration surfaces: 39/39 passed.
- Full suite: 540 core, 4 membership and 119 GUI tests passed.
- Production GUI build and `git diff --check` passed.
- Live A008 adapter probe with one function tool, requested reasoning `medium`, and requested temperature `0.7` returned `OK`; the wire request omitted temperature and normalized tool reasoning to `none`.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`
- [x] ADR 0036 compatibility note

## Handoff and Follow-ups

- Current state: Complete; verified locally and against live OpenAI.
- Next recommended step: restart the live GUI host and retry from the standalone client.
- Blockers: none.
- Child tasks: none.
- Resume condition: repository state and this task record.
- Open questions: whether a later Luna migration to Responses API should restore non-none reasoning while tools are enabled.

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore `docs/CURRENT_TASK.md` from `docs/template_CURRENT_TASK.md`.
- Append a signed `docs/JOURNAL.md` entry.
