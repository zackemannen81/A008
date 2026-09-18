# A008-0128 — embedded OpenAI output-token wire compatibility

Task ID: A008-0128
Parent Task: A008-0127
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; claim revision `71badcf`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`

## Task Summary

A008-0127 embedded OpenAI execution reaches the provider, but OpenAI chat models reject `max_tokens` and require `max_completion_tokens`. ACME-0187 published `acme-engine@0.1.4` with an explicit profile-level wire-field option.

## Task Charter

### Goal

Consume ACME 0.1.4 and explicitly select `max_completion_tokens` for A008-owned embedded OpenAI Chat Completions profiles.

### Primary Deliverable

A008 embedded OpenAI runtime config emits `max_completion_tokens` for its output budget while NVIDIA/KIE behavior remains unchanged.

### In Scope

- Bump `acme-engine` dependency to `^0.1.4`.
- Set `maxOutputTokensParameter: "max_completion_tokens"` only on embedded OpenAI profiles.
- Add regression coverage for config derivation and OpenAI wire body.

### Out of Scope

- Any memory/cognition/model-selection change.
- Provider-name/model-name inference inside ACME.
- Changes to NVIDIA or KIE generation-control semantics.
- Sidecar protocol changes.

### Definition of Done

- A008 installs registry `acme-engine@0.1.4`.
- Embedded OpenAI profile config selects `max_completion_tokens`.
- Regression verifies `max_tokens` is absent from the OpenAI body.
- Owner-run verification passes.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `203aa99`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| OpenAI output-token compatibility | A008 owns provider strategy; ACME executes prepared requests | OpenAI embedded chat stops failing HTTP 400 | dependency bump + one profile flag | focused embedded ACME tests + build |

### Minimum Verification Gates

- [x] Owner runs build.
- [x] Owner runs focused A008-0127/0128 embedded tests.
- [x] Owner confirms GUI OpenAI chat no longer returns unsupported `max_tokens`.

## References

- ACME-0187 / `acme-engine@0.1.4`
- A008-0127 embedded runtime boundary

## Checklist

- [x] Claim task id.
- [x] Bump ACME dependency.
- [x] Set OpenAI profile wire field.
- [x] Add regression.
- [x] Owner verification.
- [x] Close docs and handoff.

## Decisions and Notes

- Verification is intentionally delegated to the owner because long test processes are unreliable through Remote Desktop Commander.

## Charter Amendment Log

- none

## Verification

- Implementation-only inspection: package manifest resolves `acme-engine ^0.1.4`; installed chain is `acme-engine@0.1.4 -> @acme-engine/model-runtime@0.1.4 -> @acme-engine/adapter-model-chat-completions@0.1.4`.
- Automated build/tests intentionally not run by ChatGPT per owner request.
- Owner reports build, focused tests and full `npm run test:core` all green.
- Owner live GUI proof confirms GPT-5.6 Luna succeeds through embedded ACME when reasoning effort is `none`; the original unsupported `max_tokens` failure is gone.
- A separate provider constraint was discovered: Luna Chat Completions rejects function tools when `reasoning_effort` is above `none`. That is outside this frozen charter and is routed to A008-0129.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/JOURNAL.md`

## Handoff and Follow-ups

- Current state: complete; owner verification passed.
- Next recommended step: merge the implementation PR; A008-0129 handles the separate Luna tools/reasoning compatibility rule.
- Blockers: none.
- Child tasks: none.
- Resume condition: owner verification results.
- Open questions: none.
