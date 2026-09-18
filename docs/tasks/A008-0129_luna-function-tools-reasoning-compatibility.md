# A008-0129 — Luna function-tools reasoning compatibility

Task ID: A008-0129
Parent Task: A008-0128
Status: Complete
Owner: Grok (delegated)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; claim revision `68bc06e`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CONTRIBUTING.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/JOURNAL.md`
- `docs/FILESTRUCTURE.md`
- `docs/adr/0036-openai-gpt-56-luna-provider.md`

## Task Summary

Direct OpenAI Chat Completions already forces effective `reasoningEffort: "none"` for GPT-5.6 Luna when function tools are attached. The default embedded ACME path still forwards the session-selected effort, so Luna tool turns fail the provider while the direct path succeeds. Restore request-local parity without rewriting session or GUI state.

## Task Charter

### Goal

Make GPT-5.6 Luna Chat Completions requests that include function tools use effective `reasoningEffort: "none"` on the ACME-mapped path, matching the existing direct OpenAI transport.

### Primary Deliverable

Request-local Luna+tools reasoning guard on the shared ACME execute-body mapping, with regressions proving selected session effort is left unchanged.

### In Scope

- Apply the existing Luna+tools effective-effort rule when building the ACME execute request used by embedded and sidecar ACME.
- Keep the same rule on the direct OpenAI transport, preferably through one shared helper.
- Prove `gpt-5.6-luna` + `tools.length > 0` → effective `reasoningEffort` `"none"`.
- Prove every other model/tool combination keeps the selected effort.
- Prove the incoming request/session options object is not mutated.

### Out of Scope

- ACME engine or package changes.
- GUI policy, control hiding, or default-effort changes.
- Permanent rewrite of user/session `reasoningEffort`.
- Luna temperature omission, semantic-call options, NVIDIA/KIE, or Responses API work.

### Definition of Done

- `gpt-5.6-luna` with one or more function tools emits effective `reasoningEffort: "none"` on ACME-mapped Chat Completions requests.
- Selected reasoning effort is unchanged when tools are absent or the model is not Luna.
- Session/user-selected effort is not rewritten.
- Focused OpenAI and ACME mapping tests pass.
- Owning docs record the parity rule.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3532bcd`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Luna+tools effective reasoning none on ACME-mapped Chat Completions | PC-01 shared engine; ADR 0036 normalizes a tool-enabled Luna request to effective `reasoning_effort: none`; PC-06 keeps session controls user-owned | Default embedded Luna tool turns fail the provider while direct OpenAI succeeds | Reuse the existing request-local guard when building the ACME execute body; do not rewrite session/GUI | Focused OpenAI + ACME mapping tests |

### Minimum Verification Gates

- [x] Shared helper or equivalent mapping emits `"none"` only for `gpt-5.6-luna` with `tools.length > 0`.
- [x] ACME execute-body regression covers Luna+tools, Luna without tools, and a non-Luna model with tools.
- [x] Direct OpenAI Luna+tools regression still expects `reasoning_effort: "none"`.
- [x] Incoming request options are not mutated.
- [x] Focused tests and `git diff --check` pass.
- [x] No live provider call.

## References

- A008-0088 direct OpenAI Luna tool compatibility.
- A008-0128 discovery: Luna Chat Completions with function tools requires `reasoning_effort=none`.
- ADR 0036.

## Checklist

- [x] Freeze this charter.
- [x] Share the Luna+tools effective-effort rule between direct OpenAI and ACME mapping.
- [x] Add/update mapping regressions.
- [x] Update owning docs.
- [x] Verify named gates.
- [x] Archive, restore the current-task template, and write the handoff.

## Decisions and Notes

- The guard applies only to the effective provider/ACME request. Session parameters and GUI remain the user's selected effort.
- No ACME package change is required; A008 already owns this provider constraint on the direct path.
- One shared helper in `generation-controls.ts` is used by both the direct OpenAI adapter and `buildAcmeExecuteBody`, so sidecar ACME inherits the same request-local rule.

## Charter Amendment Log

- none

## Verification

- Actual diff matches the frozen necessity argument: only the effective request `reasoningEffort` is overridden for `gpt-5.6-luna` when tools are present. Session/GUI defaults, ACME engine, and other models are unchanged.
- `effectiveReasoningEffort("gpt-5.6-luna", 1, "medium")` → `"none"`; Luna without tools and Kimi with tools keep the selected effort.
- ACME execute-body Luna+tools mapping now emits `reasoningEffort: "none"` while `request.options.reasoningEffort` remains `"medium"`.
- Direct OpenAI Luna+tools payload still emits `reasoning_effort: "none"` and does not mutate `options.reasoningEffort`.
- Focused OpenAI + ACME tests: 30/30 PASS.
- `npm run typecheck`: PASS.
- `npm run test:core`: 662/662 PASS.
- `git diff --check`: PASS.
- Live provider call skipped: no task authority.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` — operator appends on merge
- [x] `docs/FILESTRUCTURE.md` when structure changes — no structure change
- [x] ADRs and collection indexes when needed — ADR 0036 already owns the rule

## Handoff and Follow-ups

- Current state: complete; focused and core tests passed.
- Next recommended step: operator review, merge, and signed journal entry.
- Blockers: none
- Child tasks: none
- Resume condition: n/a
- Open questions: none

## Finalize When Complete

- Archive this task under `docs/finished/`.
- Restore this template or activate the next approved task.
- Append a signed `docs/JOURNAL.md` entry.
