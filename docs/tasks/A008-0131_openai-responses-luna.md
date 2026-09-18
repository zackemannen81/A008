# A008-0131 — native OpenAI Responses routing for Luna

Task ID: A008-0131
Parent Task: A008-0127
Status: In Progress
Owner: ChatGPT (operator)
Created: 2026-09-18
Last updated: 2026-09-18
Charter frozen at: 2026-09-18; task identity claim merged in `6db6785`

## Read First

- `AGENTS.md`
- `docs/TASK_WORKFLOW.md`
- `docs/PROJECT_BRIEF.md`
- `docs/CURRENT_STATUS.md`
- `docs/SYSTEMDOC.md`
- `docs/adr/0043-acme-stage-3-5-execution-substrate.md`
- `docs/finished/A008-0127_embedded-acme-model-runtime-migration.md`
- `docs/finished/A008-0129_luna-function-tools-reasoning-compatibility.md`

## Task Summary

A008's accepted Stage-3.5 external ACME runtime routed OpenAI through ACME's native Responses adapter. A008-0127 moved execution in-process but composed OpenAI as a generic compatible Chat Completions route. ACME 0.1.5 restores native Responses image parity, so embedded A008 can return Luna to the native OpenAI route without losing attachments or changing cognition/memory semantics.

## Task Charter

### Goal

Restore native OpenAI Responses execution for embedded GPT-5.6 Luna while preserving A008 ownership of model selection, prompts, tools and memory and leaving NVIDIA/KIE execution routes unchanged.

### Primary Deliverable

Embedded ACME composition registers A008-owned OpenAI profiles under `config.openAi` on registry `acme-engine@0.1.5`, causing Luna chat, semantic JSON, tools and vision requests to execute through `/v1/responses`.

### In Scope

- Consume registry `acme-engine@0.1.5`.
- Compose A008 OpenAI profiles through ACME's native `openAi` route instead of a generic compatible Chat Completions route.
- Preserve A008 model selection/capabilities and existing OpenAI credential ownership.
- Preserve NVIDIA and KIE route/config behavior.
- Remove the Luna+tools Chat Completions reasoning override from the provider-neutral ACME request mapping so native Responses receives the selected reasoning effort.
- Keep the Luna+tools override in the direct OpenAI Chat Completions adapter.
- Update focused config/wire/parity regressions for Responses text, tools, semantic calls and native image input.
- Update runtime/status/system documentation to describe the actual OpenAI execution route.

### Out of Scope

- Changes to extraction, relation-classification, retrieval or memory prompts/algorithms.
- Responses statefulness (`previous_response_id`, `store`) or server-side conversation ownership.
- Built-in OpenAI tools, file search, web search or computer-use tools.
- Provider fallback/model switching.
- Changes to direct NVIDIA, direct KIE or direct OpenAI Chat Completions behavior.
- Live paid provider calls initiated by the operator.
- Performance conclusions about Responses vs Chat Completions; owner A/B observation follows implementation.

### Definition of Done

- Embedded config exposes Luna under `config.openAi.profiles` and no OpenAI entry under `config.compatible`.
- Embedded Luna executes against `https://api.openai.com/v1/responses`.
- Text, function-tool continuation and image input preserve the existing A008 provider-neutral request contract.
- ACME-mapped Luna tool requests preserve the selected reasoning effort; direct Chat Completions continues to force `none` where required.
- Semantic `knowledge_analysis` / relation-classification requests continue to use their existing stateless strict-JSON inputs and generation controls, but travel through Responses.
- NVIDIA/KIE route regressions remain unchanged.
- No A008 cognition or memory behavior changes are present in the diff.

### Necessity Gate

Contract: `docs/PROJECT_BRIEF.md`, PC-01 — One shared engine; PC-06 — Supported user controls and content.
Contract revision: `91f4377`
Accepted constraint: ADR 0043 — ACME may replace only A008's provider execution path; A008 retains why/what/when execution, cognition and memory ownership.

| Change | Clause and constraint | Outcome; consequence if omitted | Smallest sufficient change | Planned check |
| --- | --- | --- | --- | --- |
| Native OpenAI Responses composition | PC-01 + ADR 0043 | Embedded A008 keeps a different OpenAI execution route than the accepted Stage-3.5 Responses path and cannot directly compare the earlier semantic-execution behavior | move only OpenAI profiles from `compatible` to native `openAi` using ACME 0.1.5 | config + real-runtime fake-transport wire regression |
| Preserve native vision | PC-06 + ADR 0043 | Returning to Responses would regress A008-0130 attachments if image parts are not carried | consume ACME 0.1.5 image parity; no second image path | mixed text/image Responses body regression |
| Remove Chat-Completions-only ACME workaround | PC-01 + ADR 0043 | Native Responses would still receive altered request semantics from the superseded Chat Completions route | provider-neutral ACME mapping passes selected reasoning effort; direct OpenAI adapter keeps its local workaround | ACME request + direct transport regressions |

### Minimum Verification Gates

- [x] Embedded config regression: OpenAI native profile; NVIDIA/KIE unchanged.
- [x] Embedded real-runtime fake transport proves `/v1/responses` text call.
- [x] Embedded Responses vision regression proves ordered `input_text` + `input_image`.
- [x] Function-tool/reasoning parity regression.
- [x] Semantic-operation regression proves Luna semantic calls use Responses while retaining `reasoningEffort: none`.
- [x] Direct OpenAI Chat Completions Luna+tools regression remains green.
- [x] Root TypeScript typecheck, build and `git diff --check`.
- [ ] Owner manual A/B smoke after integration; no operator-paid call.

## Checklist

- [x] Claim task id.
- [x] Freeze charter.
- [x] Upgrade ACME dependency to 0.1.5.
- [x] Route embedded OpenAI through native Responses.
- [x] Restore provider-neutral ACME reasoning semantics.
- [x] Update focused regressions.
- [x] Run bounded verification.
- [ ] Owner manual A/B smoke.
- [ ] Update docs and handoff.
- [ ] Archive task and restore CURRENT_TASK template.

## Decisions and Notes

- ACME 0.1.5 registry-only consumer proof already demonstrated native `/v1/responses` with mixed `input_text` + `input_image`.
- The direct `OpenAiChatTransport` remains Chat Completions and retains its Luna function-tools workaround as a reference/debug path.
- Semantic calls already use `stream:false`, no history, strict JSON input and `reasoningEffort:none`; this task does not change those controls.

## Charter Amendment Log

- none

## Verification

- Registry dependency resolves `acme-engine@0.1.5 -> @acme-engine/model-runtime@0.1.5 -> @acme-engine/adapter-model-openai@0.1.5`.
- Root TypeScript typecheck and build passed.
- Focused A008-0127 embedded ACME, ACME transport, runtime-preferences and direct OpenAI suites passed 51/51.
- Embedded native OpenAI proof emitted `https://api.openai.com/v1/responses` with ordered `input_text` + `input_image`, function tools, `max_output_tokens` and selected `reasoning.effort: "medium"`.
- Runtime semantic proof executed `retrieval_scope -> chat -> knowledge_analysis -> relation_classification -> commit`; every Luna call used `/v1/responses`, semantic operations retained `reasoning.effort: "none"`, and chat retained `"medium"`.
- Direct `OpenAiChatTransport` regressions remain green and still force Luna+tools reasoning to `none` on Chat Completions.
- NVIDIA embedded route regression remains on `https://integrate.api.nvidia.com/v1/chat/completions`; KIE config remains in compatible routes.
- `git diff --check` passed.
- Full core/GUI suites were not run through Remote Desktop Commander; owner manual A/B smoke remains pending.
- No paid/live provider call was initiated by the operator.

## Documentation Updates

- [x] `docs/CURRENT_STATUS.md`
- [x] `docs/SYSTEMDOC.md`
- [ ] `docs/JOURNAL.md` — operator merge record
- [ ] `docs/handoffs/A008-0131.md`

## Handoff and Follow-ups

- Current state: implementation and focused offline verification complete; owner live A/B smoke pending.
- Next recommended step: restart the GUI host on this branch and compare Luna extraction/classification behavior and latency against the prior nesdemo observation.
- Blockers: none.
- Child tasks: none.
- Resume condition: n/a.
- Open questions: none.
