# A008-0153 — Catalog-backed runtime model registry

Task ID: A008-0153
Parent Task: A008-0152
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-22
Last updated: 2026-09-22
Charter frozen at: ef497dd

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/finished/A008-0152_zerocost-provider-execution.md`
- `docs/handoffs/A008-0152.md`

## Task Summary

A008-0152 made user-catalog providers executable, but the runtime session registry
still defaulted to the static shipped `defaultModelRegistry`. The GUI/ACP model
list could therefore expose a valid imported model while
`LocalMemoryRuntime.sessionParameters()` and session creation rejected the same
id as `Unknown model`.

## Goal

Make the runtime, ACP model controls and `/v1/models` share the same model
truth: shipped profiles plus the current user catalog, without hardcoding
imported model ids and without requiring a host restart after catalog mutation.

## In Scope

- Allow `ModelRegistry` to compose dynamic profiles while shipped profiles
  retain precedence.
- Build the ACP/local runtime registry from shipped profiles plus the current
  configured user catalog.
- Read dynamic catalog profiles at lookup/list time so a model added after
  runtime startup is available to a newly created session immediately.
- Preserve existing provider routing, generation-control defaults and user
  catalog validation.
- Add regressions proving dynamic update and shipped-profile precedence.
- Verify the concrete operator catalog models that reproduced the bug without
  making provider calls.

## Out of Scope

- Adding or hardcoding individual model ids.
- Changing ZeroCostRadar feed semantics or provider routing.
- Changing provider credentials or fallback policy.
- Provider capability discovery beyond the existing conservative unverified
  defaults.
- Any live model inference.
- Agent-browser/MCP follow-up work.

## Necessity Gate

The existing `ModelRegistry` is already the runtime authority. The smallest
sufficient change is to let it compose a dynamic profile source and give the ACP
runtime one catalog-backed instance. Do not create a second registry subsystem,
cache, watcher or restart mechanism.

## Definition of Done

- [x] A user-catalog model absent from the shipped registry resolves through
  `LocalMemoryRuntime.sessionParameters()`.
- [x] A model added after runtime startup is available without host restart.
- [x] ACP session creation accepts that model.
- [x] Shipped profiles retain precedence over duplicate dynamic ids.
- [x] No provider call is needed to validate registry resolution.
- [x] Root typecheck/full test suite pass.
- [x] GUI suite passes through the repository test gate.
- [x] `git diff --check` passes.
- [x] Owning docs/handoff/closure are current.

## Verification

Focused verification:
- model-registry + project-runtime-registry: 17/17 passed.
- Read-only smoke against the operator's actual catalog resolved
  `thinkingmachines/inkling:free`, `moonshotai/kimi-k2.6` and
  `openai/gpt-oss-120b` through runtime session parameters.
- Full repository gate: 722/722 core + 4/4 membership + 189/189 GUI = 915/915.
- Root typecheck passed.
- GUI production build passed with only existing Zod/bundle-size warnings.
- `git diff --check` passed.
- No live provider call was made.

## Checklist

- [x] Claim task and isolate worktree.
- [x] Reproduce split model truth.
- [x] Add dynamic registry composition.
- [x] Wire ACP/local runtime to the catalog-backed registry.
- [x] Add focused regressions.
- [x] Run full verification.
- [x] Update current-state docs.
- [x] Archive task, write handoff, restore CURRENT_TASK and push.
