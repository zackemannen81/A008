# A008-0115 — Luna semantic control compatibility

Task ID: A008-0115
Parent Task: A008-0114
Status: In Progress
Owner: Codex (operator)
Created: 2026-09-15
Last updated: 2026-09-15
Charter frozen at: 2026-09-15; contract revision `3532bcd`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0043-acme-execution-boundary.md`
- `docs/finished/A008-0114_acme-execution-evaluation.md`

## Task Summary

After A008-0114 routed stateless semantic calls through ACME, live Luna calls exposed an unsupported generation control: semantic JSON defaults force `temperature: 0`, while GPT-5.6 Luna accepts only its provider default. Retrieval scope intentionally fails open, hiding the classifier failure and broadening context; post-output knowledge analysis reports staging failure.

## Task Charter

### Goal

Restore Luna semantic retrieval classification and post-output knowledge analysis without changing A008 memory semantics or ACME's non-cognitive execution boundary.

### Primary Deliverable

A model-specific semantic-generation compatibility fix that omits `temperature` for GPT-5.6 Luna while preserving existing semantic defaults for models that support them, with regression tests covering retrieval and extraction paths.

### In Scope

- Treat `temperature: null` as an explicit omission in semantic JSON generation normalization.
- Emit `temperature: null` from Luna's semantic generation profile.
- Verify retrieval-scope and knowledge-analysis semantic calls no longer carry `temperature` through the selected transport.
- Preserve `reasoningEffort: "none"`, output budget, strict JSON parsing, fail-open retrieval policy, and all memory lifecycle semantics.

### Out of Scope

- Changes to ACME execution semantics or provider runtime implementation.
- Changes to retrieval ranking, thresholds, labels, domains, scope accumulation, memory schema, strength, decay, reinforcement, supersede/replace, relations, or persistence.
- General provider capability redesign or changing user-facing chat generation controls.
- Live paid-provider testing unless separately necessary and authorized.

### Definition of Done

- Luna semantic requests omit `temperature` before reaching ACME/provider execution.
- Retrieval scope classification can execute instead of degrading solely because of the unsupported temperature control.
- Post-output knowledge analysis can execute instead of staging-failing solely because of the same control.
- Non-Luna semantic defaults remain unchanged.
- Targeted tests, TypeScript checks and `git diff --check` pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, Core Product Contract
Contract revision: `3532bcd`

| Change | Clause and accepted constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Omit unsupported Luna semantic temperature | PC-02, PC-04 + ADR 0043 | Classified-domain retrieval and post-turn durable knowledge must survive the ACME execution route; omission leaves retrieval degraded and write staging failed. | Reuse the existing nullable generation-control contract and omit only Luna semantic temperature. | Assert Luna semantic requests contain no temperature while other semantic defaults remain stable. |

## Minimum Verification Gates

- [ ] Semantic generation normalizer treats `temperature: null` as omission.
- [ ] Luna retrieval-scope semantic request omits temperature.
- [ ] Luna knowledge-analysis semantic request omits temperature.
- [ ] Existing semantic JSON tests pass.
- [ ] ACME transport/parity tests pass.
- [ ] `npm run typecheck` or repository-equivalent TypeScript gate passes.
- [ ] `git diff --check` passes.

## Decisions and Notes

- This task changes provider-call compatibility only. A008 remains cognitive owner; ACME remains execution-only.
- The retrieval fail-open behavior remains unchanged; this task removes the observed reason it was being exercised for Luna.
- No memory-engine representation or lifecycle policy is modified.

## Verification

Pending implementation.
