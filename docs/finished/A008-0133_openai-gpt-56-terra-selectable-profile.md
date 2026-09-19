# A008-0133 — OpenAI GPT-5.6 Terra selectable profile

Task ID: A008-0133
Parent Task: None
Status: Complete
Owner: ChatGPT (operator)
Created: 2026-09-19
Last updated: 2026-09-19
Charter frozen at: 2026-09-19

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/finished/A008-0131_native-openai-responses-routing-for-luna.md`

## Task Summary

Add OpenAI GPT-5.6 Terra as a shipped selectable model beside GPT-5.6 Luna so the owner can compare scenarios through the existing native OpenAI Responses path before Stage 4 begins.

## Task Charter

### Goal

Expose `gpt-5.6-terra` as an additional OpenAI model without changing Luna defaults or any cognition, memory, tool-approval, project/session, or Stage-4 behavior.

### Primary Deliverable

A verified Terra model profile in the existing registry/capability/runtime composition, automatically composed into ACME native OpenAI Responses alongside Luna.

### In Scope

- Terra shipped model profile and public export.
- Terra generation capabilities matching current OpenAI documentation.
- Existing embedded ACME OpenAI composition includes Terra automatically.
- Terra semantic JSON calls use the same stateless OpenAI controls as Luna.
- Focused registry/config/routing regressions and current model documentation.

### Out of Scope

- Replacing Luna as a default or fallback.
- Provider fallback or automatic model switching.
- Changes to prompts, extraction, classification, retrieval, memory, tools, sessions, V2, or Stage 4.
- Live paid provider calls by the operator.

### Definition of Done

- GUI/host model inventory can select both Luna and Terra.
- Terra resolves to executionProvider `openai` and native Responses composition.
- Luna remains unchanged and selectable.
- Terra semantic calls use reasoning `none` and omit generic sampling controls already unsupported for OpenAI semantic calls.
- Focused tests, typecheck/build and diff hygiene pass.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-06 — Supported user controls and content.
Contract revision: cca0431

| Change | Clause and constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Terra model profile | PC-06 + existing OpenAI owner | Owner cannot select the requested supported model for scenario comparison | add one shipped profile and capability row | registry/session tests |
| Native Responses composition | PC-06 + A008-0131 boundary | Terra could appear selectable but route incorrectly | reuse executionProvider=openai auto-composition; no new transport | embedded config test |
| Semantic compatibility | PC-04/06 existing semantic owner | selected Terra could fail post-output semantic calls | reuse stateless reasoning-none semantic generation | runtime-preferences regression |

### Minimum Verification Gates

- [x] Registry exposes Luna and Terra with text/image input and OpenAI execution.
- [x] Generation capabilities expose Terra 128K output and documented reasoning efforts.
- [x] Embedded ACME config exposes both under native `openAi.profiles`.
- [x] Luna remains unchanged and no default switches to Terra.
- [x] Focused tests, root typecheck/build and `git diff --check` pass.
- [x] No paid/live provider call required.

## Checklist

- [x] Claim A008-0133 on main.
- [x] Freeze charter Ready.
- [x] Implement bounded Terra profile support.
- [x] Verify focused behavior.
- [x] Update owning docs.
- [x] Archive/handoff and restore CURRENT_TASK.

## Decisions and Notes

- OpenAI documentation checked 2026-09-19: `gpt-5.6-terra` supports text/image input, Responses API, 128K max output and reasoning efforts none/low/medium/high/xhigh/max.
- Terra is additive. Luna stays the existing default wherever Luna was already the default.
- The direct Chat Completions adapter remains a reference path; embedded ACME native Responses is the active OpenAI route.

## Verification

- Focused build/test gate passed 28/28: model registry, dispatch, session controls, embedded ACME and public exports.
- Embedded config proof exposes both Luna and Terra under native `openAi.profiles`; no OpenAI compatible-route fallback was introduced.
- Root `npm run typecheck --silent`, `npm run build --silent` and `git diff --check` passed.
- Luna remains the existing fallback/default; Terra is explicit and additive only.
- No live/paid provider call was made for this task.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [x] `docs/HOST_PROTOCOL.md`
- [ ] `docs/JOURNAL.md` — operator merge entry on main
- [x] handoff/archive

## Handoff and Follow-ups

- Current state: Complete; ready for integration.
- Next recommended step: merge A008-0133, then activate A008-0132 Stage 4 from updated main.
- Blockers: none.
